/**
 * Zod schemas and TypeScript types for the taxonomy argument graph.
 * Mirrors the Prisma schema enums and shapes defined in prisma/schema.prisma.
 * These types flow through: extraction → DB persistence → SSE → SPA.
 */

import { z } from 'zod';

// ── Enum value arrays (shared with prompts) ────────────────────────────────────

export const ARG_TYPE_VALUES = [
	'PROBLEM_FRAMING',
	'DIAGNOSTIC_CAUSAL',
	'NORMATIVE_EVALUATIVE',
	'PROPOSAL_PRESCRIPTION',
	'IMPLEMENTATION_DESIGN',
	'CONSEQUENCE_FORECAST',
	'FACTUAL_PREMISE_DISPUTE',
	'LEGAL_PROCEDURAL',
	'ACTOR_APPRAISAL',
	// v2 — included so the schema compiles; excluded from extraction prompts until calibrated:
	'TRADEOFF_BALANCING',
	'COALITION_STRATEGY',
	'META_DISCURSIVE',
] as const;

export type ArgType = (typeof ARG_TYPE_VALUES)[number];

export const CLAIM_ROLE_VALUES = [
	'CORE_THESIS',
	'SUPPORTING_REASON',
	'REBUTTAL',
	'CONCESSION',
	'ANALOGY',
	'ILLUSTRATIVE_EXAMPLE',
] as const;

export const CENTRALITY_VALUES = ['CENTRAL', 'SUPPORTING', 'PERIPHERAL'] as const;

export const LINK_CONFIDENCE_VALUES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export const ISSUE_RELATION_TYPE_VALUES = [
	'SIBLING',
	'LINKED_LEGALITY',
	'LINKED_ACTOR',
	'LINKED_PROCESS',
	'LINKED_CONSEQUENCE',
	'CLUSTER',
] as const;

// ── Pass 1 extraction output ───────────────────────────────────────────────────

// v1 operational arg types passed to Claude (excludes v2 types)
const V1_ARG_TYPES = [
	'PROBLEM_FRAMING',
	'DIAGNOSTIC_CAUSAL',
	'NORMATIVE_EVALUATIVE',
	'PROPOSAL_PRESCRIPTION',
	'IMPLEMENTATION_DESIGN',
	'CONSEQUENCE_FORECAST',
	'FACTUAL_PREMISE_DISPUTE',
	'LEGAL_PROCEDURAL',
	'ACTOR_APPRAISAL',
] as const;

export const RawArgUnitSchema = z.object({
	textSpan: z.string().min(1),
	claimSummary: z.string().min(1),
	argType: z.enum(V1_ARG_TYPES),
	secondaryType: z.enum(V1_ARG_TYPES).optional(),
	claimRole: z.enum(CLAIM_ROLE_VALUES),
	centrality: z.enum(CENTRALITY_VALUES),
	position: z.string().optional(),
	evidenceStyle: z.string().optional(),
	factualUncertainty: z.string().optional(),
	interpretivelyAmbiguous: z.boolean().default(false),
	targetActorName: z.string().optional(),
	targetActorType: z.string().optional(),
	issueHint: z.string().optional(),
	proposalHint: z.string().optional(),
	domain: z.string().optional(),
	geoScope: z.string().optional(),
	timeHorizon: z.string().optional(),
});

export type RawArgUnit = z.infer<typeof RawArgUnitSchema>;

export const Pass1TaxResultSchema = z.object({
	sourceUrl: z.string(),
	sourceAuthor: z.string().nullish(),
	sourceOutlet: z.string().nullish(),
	sourceTitle: z.string().nullish(),
	units: z.array(RawArgUnitSchema),
});

export type Pass1TaxResult = z.infer<typeof Pass1TaxResultSchema>;

// ── Pass 2 synthesis output ────────────────────────────────────────────────────

export const IssueSynthSchema = z.object({
	tempId: z.string(),
	title: z.string(),
	description: z.string().optional(),
	domain: z.string().optional(),
	geography: z.string().optional(),
	timeHorizon: z.string().optional(),
	arena: z.string().optional(),
	parentTempId: z.string().optional(),
	linkedIssues: z
		.array(
			z.object({
				tempId: z.string(),
				relationType: z.enum(ISSUE_RELATION_TYPE_VALUES),
			}),
		)
		.optional(),
});

export type IssueSynth = z.infer<typeof IssueSynthSchema>;

export const ProposalSynthSchema = z.object({
	tempId: z.string(),
	title: z.string(),
	actionVerb: z.string().optional(),
	actorName: z.string().optional(),
	isBundle: z.boolean().default(false),
	parentTempId: z.string().optional(),
	status: z.string().optional(),
	claimedEnds: z.string().optional(),
	proposedMeans: z.string().optional(),
	opposedMeans: z.string().optional(),
	altMeans: z.string().optional(),
	issueTempId: z.string().optional(),
});

export type ProposalSynth = z.infer<typeof ProposalSynthSchema>;

export const UnitLinkageSchema = z.object({
	unitIndex: z.number().int().nonnegative(),
	issueTempId: z.string().optional(),
	proposalTempId: z.string().optional(),
	questionText: z.string().optional(),
	positionRefined: z.string().optional(),
	issueLinkConfidence: z.enum(LINK_CONFIDENCE_VALUES).optional(),
	proposalLinkConfidence: z.enum(LINK_CONFIDENCE_VALUES).optional(),
});

export type UnitLinkage = z.infer<typeof UnitLinkageSchema>;

export const SynthesisResultSchema = z.object({
	issues: z.array(IssueSynthSchema),
	proposals: z.array(ProposalSynthSchema),
	unitLinkages: z.array(UnitLinkageSchema),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// ── Full taxonomy extraction result (pre-DB) ───────────────────────────────────

export interface TaxonomyExtraction {
	query: string;
	strategy: string;
	numSources: number;
	pass1Results: Pass1TaxResult[];
	synthesis: SynthesisResult;
}

// ── ArgGraphSummary — sent over SSE and used by the SPA ───────────────────────

export interface IssueSummary {
	id: string;
	title: string;
	description: string | null;
	domain: string | null;
	parentId: string | null;
	status: string;
}

export interface ProposalSummary {
	id: string;
	title: string;
	isBundle: boolean;
	parentId: string | null;
	status: string;
	issueId: string | null;
	actionVerb: string | null;
	claimedEnds: string | null;
	proposedMeans: string | null;
}

export interface ArgUnitSummary {
	id: string;
	argType: string;
	claimSummary: string;
	textSpan: string;
	claimRole: string;
	centrality: string;
	position: string | null;
	evidenceStyle: string | null;
	issueId: string | null;
	proposalId: string | null;
	author: string | null;
	outlet: string | null;
	sourceUrl: string;
	sourceTitle: string | null;
	targetActorName: string | null;
	issueLinkConfidence: string | null;
	proposalLinkConfidence: string | null;
}

export interface ArgGraphSummary {
	runId: string;
	query: string;
	issues: IssueSummary[];
	proposals: ProposalSummary[];
	argumentUnits: ArgUnitSummary[];
}
