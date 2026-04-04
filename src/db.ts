/**
 * Prisma singleton and taxonomy DB persistence.
 * Uses @prisma/adapter-libsql for SQLite via libsql (Prisma 7).
 */

import { PrismaLibSql } from '@prisma/adapter-libsql';
import {
	ActorType,
	EvidenceStyle,
	GeoScope,
	LinkConfidence,
	PositionValue,
	PrismaClient,
	ProposalStatus,
	TimeHorizon,
} from '@prisma/client';

import { log } from './logger.js';
import { getSettings } from './settings.js';
import type {
	ArgGraphSummary,
	ArgUnitSummary,
	IssueSummary,
	ProposalSummary,
	TaxonomyExtraction,
} from './taxonomy-models.js';

// ── Prisma singleton ───────────────────────────────────────────────────────────

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
	if (_prisma === undefined) {
		const url = getSettings().databaseUrl;
		const adapter = new PrismaLibSql({ url });
		_prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
	}
	return _prisma;
}

export function resetPrisma(): void {
	_prisma = undefined;
}

// ── Taxonomy persistence ───────────────────────────────────────────────────────

/**
 * Write a completed TaxonomyExtraction to the database.
 * Returns a lean ArgGraphSummary suitable for sending over SSE.
 */
export async function persistTaxonomy(extraction: TaxonomyExtraction): Promise<ArgGraphSummary> {
	const prisma = getPrisma();
	const { query, strategy, numSources, pass1Results, synthesis } = extraction;

	// 1. Create SearchRun
	const run = await prisma.searchRun.create({
		data: { query, strategy, numSources },
	});

	// 2. Flat list of all raw units (indexed so UnitLinkage.unitIndex is correct)
	const allUnits = pass1Results.flatMap((p1) =>
		p1.units.map((u) => ({
			unit: u,
			sourceUrl: p1.sourceUrl,
			sourceAuthor: p1.sourceAuthor ?? null,
			sourceOutlet: p1.sourceOutlet ?? null,
			sourceTitle: p1.sourceTitle ?? null,
		})),
	);

	// 3. Create Issues (root issues first, then children via a second pass)
	const issueIdByTempId = new Map<string, string>();

	// First pass: create all issues without parent
	for (const iss of synthesis.issues) {
		const created = await prisma.issue.create({
			data: {
				title: iss.title,
				description: iss.description ?? null,
				domain: iss.domain ?? null,
				geography: iss.geography ?? null,
				timeHorizon: iss.timeHorizon ? _toTimeHorizon(iss.timeHorizon) : null,
				arena: iss.arena ?? null,
				searchRunId: run.id,
			},
		});
		issueIdByTempId.set(iss.tempId, created.id);
	}

	// Second pass: wire parent-child links
	for (const iss of synthesis.issues) {
		if (!iss.parentTempId) continue;
		const id = issueIdByTempId.get(iss.tempId);
		const parentId = issueIdByTempId.get(iss.parentTempId);
		if (!id || !parentId) continue;
		await prisma.issue.update({ where: { id }, data: { parentId } });
	}

	// 4. Create IssueRelations
	for (const iss of synthesis.issues) {
		if (!iss.linkedIssues) continue;
		const fromId = issueIdByTempId.get(iss.tempId);
		if (!fromId) continue;
		for (const link of iss.linkedIssues) {
			const toId = issueIdByTempId.get(link.tempId);
			if (!toId || fromId === toId) continue;
			await prisma.issueRelation.create({
				data: { fromId, toId, relationType: link.relationType },
			});
		}
	}

	// 5. Create Proposals (bundles first, then components)
	const proposalIdByTempId = new Map<string, string>();
	const bundles = synthesis.proposals.filter((p) => p.isBundle);
	const nonBundles = synthesis.proposals.filter((p) => !p.isBundle);
	const orderedProposals = [...bundles, ...nonBundles];

	for (const prop of orderedProposals) {
		const issueId = prop.issueTempId ? (issueIdByTempId.get(prop.issueTempId) ?? null) : null;
		const parentId = prop.parentTempId ? (proposalIdByTempId.get(prop.parentTempId) ?? null) : null;
		const created = await prisma.proposal.create({
			data: {
				title: prop.title,
				actionVerb: prop.actionVerb ?? null,
				actorName: prop.actorName ?? null,
				isBundle: prop.isBundle,
				parentId,
				status: _toProposalStatus(prop.status),
				claimedEnds: prop.claimedEnds ?? null,
				proposedMeans: prop.proposedMeans ?? null,
				opposedMeans: prop.opposedMeans ?? null,
				altMeans: prop.altMeans ?? null,
				issueId,
				searchRunId: run.id,
			},
		});
		proposalIdByTempId.set(prop.tempId, created.id);
	}

	// 6. Create ArgumentUnits
	const createdUnits: ArgUnitSummary[] = [];

	for (let i = 0; i < allUnits.length; i++) {
		const entry = allUnits[i];
		if (!entry) continue;
		const { unit, sourceUrl, sourceAuthor, sourceOutlet, sourceTitle } = entry;
		const linkage = synthesis.unitLinkages.find((l) => l.unitIndex === i);

		const issueId = linkage?.issueTempId
			? (issueIdByTempId.get(linkage.issueTempId) ?? null)
			: null;
		const proposalId = linkage?.proposalTempId
			? (proposalIdByTempId.get(linkage.proposalTempId) ?? null)
			: null;
		const position = linkage?.positionRefined ?? unit.position ?? null;
		const issueLinkConf = linkage?.issueLinkConfidence ?? null;
		const proposalLinkConf = linkage?.proposalLinkConfidence ?? null;

		const created = await prisma.argumentUnit.create({
			data: {
				sourceUrl,
				sourceTitle: sourceTitle ?? null,
				author: sourceAuthor,
				outlet: sourceOutlet,
				textSpan: unit.textSpan,
				claimSummary: unit.claimSummary,
				argType: unit.argType,
				secondaryType: unit.secondaryType ?? null,
				claimRole: unit.claimRole,
				centrality: unit.centrality,
				position: position ? _toPositionValue(position) : null,
				evidenceStyle: unit.evidenceStyle ? _toEvidenceStyle(unit.evidenceStyle) : null,
				factualUncertainty: unit.factualUncertainty ?? null,
				interpretivelyAmbiguous: unit.interpretivelyAmbiguous ?? false,
				targetActorName: unit.targetActorName ?? null,
				targetActorType: unit.targetActorType ? _toActorType(unit.targetActorType) : null,
				domain: unit.domain ?? null,
				geoScope: unit.geoScope ? _toGeoScope(unit.geoScope) : null,
				timeHorizon: unit.timeHorizon ? _toTimeHorizon(unit.timeHorizon) : null,
				issueHint: unit.issueHint ?? null,
				proposalHint: unit.proposalHint ?? null,
				issueId,
				proposalId,
				issueLinkConfidence: issueLinkConf ? _toLinkConfidence(issueLinkConf) : null,
				proposalLinkConfidence: proposalLinkConf ? _toLinkConfidence(proposalLinkConf) : null,
				searchRunId: run.id,
			},
		});

		createdUnits.push({
			id: created.id,
			argType: created.argType,
			claimSummary: created.claimSummary,
			textSpan: created.textSpan,
			claimRole: created.claimRole,
			centrality: created.centrality,
			position: created.position,
			evidenceStyle: created.evidenceStyle,
			issueId: created.issueId,
			proposalId: created.proposalId,
			author: created.author,
			outlet: created.outlet,
			sourceUrl: created.sourceUrl,
			sourceTitle: created.sourceTitle,
			targetActorName: created.targetActorName,
			issueLinkConfidence: created.issueLinkConfidence,
			proposalLinkConfidence: created.proposalLinkConfidence,
		});
	}

	log.info(
		{
			runId: run.id,
			issues: issueIdByTempId.size,
			proposals: proposalIdByTempId.size,
			units: createdUnits.length,
		},
		'taxonomy_persisted',
	);

	// 7. Build and return ArgGraphSummary
	const issueSummaries: IssueSummary[] = synthesis.issues.map((iss) => ({
		id: issueIdByTempId.get(iss.tempId) ?? '',
		title: iss.title,
		description: iss.description ?? null,
		domain: iss.domain ?? null,
		parentId: iss.parentTempId ? (issueIdByTempId.get(iss.parentTempId) ?? null) : null,
		status: 'ACTIVE',
	}));

	const proposalSummaries: ProposalSummary[] = synthesis.proposals.map((prop) => ({
		id: proposalIdByTempId.get(prop.tempId) ?? '',
		title: prop.title,
		isBundle: prop.isBundle,
		parentId: prop.parentTempId ? (proposalIdByTempId.get(prop.parentTempId) ?? null) : null,
		status: _toProposalStatus(prop.status),
		issueId: prop.issueTempId ? (issueIdByTempId.get(prop.issueTempId) ?? null) : null,
		actionVerb: prop.actionVerb ?? null,
		claimedEnds: prop.claimedEnds ?? null,
		proposedMeans: prop.proposedMeans ?? null,
	}));

	const unitSummaries: ArgUnitSummary[] = createdUnits;

	return {
		runId: run.id,
		query,
		issues: issueSummaries,
		proposals: proposalSummaries,
		argumentUnits: unitSummaries,
	};
}

/** Retrieve a stored ArgGraphSummary by SearchRun ID. */
export async function getArgGraph(runId: string): Promise<ArgGraphSummary | null> {
	const prisma = getPrisma();
	const run = await prisma.searchRun.findUnique({
		where: { id: runId },
		include: {
			issues: true,
			proposals: true,
			argumentUnits: true,
		},
	});
	if (!run) return null;

	const issueSummaries: IssueSummary[] = run.issues.map((iss) => ({
		id: iss.id,
		title: iss.title,
		description: iss.description,
		domain: iss.domain,
		parentId: iss.parentId,
		status: iss.status,
	}));

	const proposalSummaries: ProposalSummary[] = run.proposals.map((p) => ({
		id: p.id,
		title: p.title,
		isBundle: p.isBundle,
		parentId: p.parentId,
		status: p.status,
		issueId: p.issueId,
		actionVerb: p.actionVerb,
		claimedEnds: p.claimedEnds,
		proposedMeans: p.proposedMeans,
	}));

	const unitSummaries: ArgUnitSummary[] = run.argumentUnits.map((u) => ({
		id: u.id,
		argType: u.argType,
		claimSummary: u.claimSummary,
		textSpan: u.textSpan,
		claimRole: u.claimRole,
		centrality: u.centrality,
		position: u.position,
		evidenceStyle: u.evidenceStyle,
		issueId: u.issueId,
		proposalId: u.proposalId,
		author: u.author,
		outlet: u.outlet,
		sourceUrl: u.sourceUrl,
		sourceTitle: u.sourceTitle,
		targetActorName: u.targetActorName,
		issueLinkConfidence: u.issueLinkConfidence,
		proposalLinkConfidence: u.proposalLinkConfidence,
	}));

	return {
		runId: run.id,
		query: run.query,
		issues: issueSummaries,
		proposals: proposalSummaries,
		argumentUnits: unitSummaries,
	};
}

// ── Enum coercions (string → Prisma enum) ─────────────────────────────────────
// Claude may return slightly different casing or spacing; normalize gracefully.

function _toProposalStatus(s: string | undefined): ProposalStatus {
	const map: Record<string, ProposalStatus> = {
		hypothetical: 'HYPOTHETICAL',
		advocated: 'ADVOCATED',
		introduced: 'INTRODUCED',
		on_ballot: 'ON_BALLOT',
		under_review: 'UNDER_REVIEW',
		adopted: 'ADOPTED',
		implemented: 'IMPLEMENTED',
		blocked: 'BLOCKED',
	};
	return map[s?.toLowerCase().replace(/-/g, '_') ?? ''] ?? 'HYPOTHETICAL';
}

function _toTimeHorizon(s: string): TimeHorizon | null {
	const map: Record<string, TimeHorizon> = {
		immediate: 'IMMEDIATE',
		'near-term': 'NEAR_TERM',
		near_term: 'NEAR_TERM',
		nearterm: 'NEAR_TERM',
		'long-term': 'LONG_TERM',
		long_term: 'LONG_TERM',
		longterm: 'LONG_TERM',
	};
	return map[s.toLowerCase()] ?? null;
}

function _toGeoScope(s: string): GeoScope | null {
	const map: Record<string, GeoScope> = {
		local: 'LOCAL',
		national: 'NATIONAL',
		regional: 'REGIONAL',
		global: 'GLOBAL',
	};
	return map[s.toLowerCase()] ?? null;
}

function _toActorType(s: string): ActorType | null {
	const m = s.toLowerCase();
	if (m === 'person') return 'PERSON';
	if (m === 'institution') return 'INSTITUTION';
	return null;
}

function _toLinkConfidence(s: string): LinkConfidence | null {
	const m = s.toUpperCase();
	if (m === 'LOW' || m === 'MEDIUM' || m === 'HIGH') return m as LinkConfidence;
	return null;
}

function _toPositionValue(s: string): PositionValue | null {
	const map: Record<string, PositionValue> = {
		for: 'FOR',
		against: 'AGAINST',
		'for-with-conditions': 'FOR_WITH_CONDITIONS',
		for_with_conditions: 'FOR_WITH_CONDITIONS',
		'for-in-principle-against-current': 'FOR_IN_PRINCIPLE_AGAINST_CURRENT',
		for_in_principle_against_current: 'FOR_IN_PRINCIPLE_AGAINST_CURRENT',
		'prefer-alternative': 'PREFER_ALTERNATIVE',
		prefer_alternative: 'PREFER_ALTERNATIVE',
		positive: 'POSITIVE',
		negative: 'NEGATIVE',
		comparative: 'COMPARATIVE',
		mixed: 'MIXED',
		unclear: 'UNCLEAR',
		'affirms-premise': 'AFFIRMS_PREMISE',
		affirms_premise: 'AFFIRMS_PREMISE',
		'denies-premise': 'DENIES_PREMISE',
		denies_premise: 'DENIES_PREMISE',
		'reframes-premise': 'REFRAMES_PREMISE',
		reframes_premise: 'REFRAMES_PREMISE',
		'uncertainty-too-high': 'UNCERTAINTY_TOO_HIGH',
		uncertainty_too_high: 'UNCERTAINTY_TOO_HIGH',
		just: 'JUST',
		unjust: 'UNJUST',
		prudent: 'PRUDENT',
		imprudent: 'IMPRUDENT',
		legitimate: 'LEGITIMATE',
		illegitimate: 'ILLEGITIMATE',
		democratic: 'DEMOCRATIC',
		undemocratic: 'UNDEMOCRATIC',
		humane: 'HUMANE',
		inhumane: 'INHUMANE',
	};
	return map[s.toLowerCase().replace(/ /g, '-')] ?? null;
}

function _toEvidenceStyle(s: string): EvidenceStyle | null {
	const map: Record<string, EvidenceStyle> = {
		moral: 'MORAL',
		empirical: 'EMPIRICAL',
		legal: 'LEGAL',
		'historical-analogy': 'HISTORICAL_ANALOGY',
		historical_analogy: 'HISTORICAL_ANALOGY',
		'historical analogy': 'HISTORICAL_ANALOGY',
		'expert-authority': 'EXPERT_AUTHORITY',
		expert_authority: 'EXPERT_AUTHORITY',
		'expert authority': 'EXPERT_AUTHORITY',
		procedural: 'PROCEDURAL',
		strategic: 'STRATEGIC',
	};
	return map[s.toLowerCase()] ?? null;
}
