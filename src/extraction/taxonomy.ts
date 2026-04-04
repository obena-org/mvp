/**
 * Taxonomy extraction strategy — three-pass argument graph extraction.
 *
 * Pass 1 (parallel): extract structured ArgumentUnits from each source.
 * Pass 2 (single call): synthesize canonical Issues, Proposals, and unit linkages.
 * Pass 3: deferred to v2 (relation edge extraction).
 *
 * See: docs/taxonomy-query-strategy.md
 */

import { createHash } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { type KPACache, getCache } from '../cache.js';
import { log } from '../logger.js';
import type { Source } from '../models.js';
import { TAX_PASS1_V, TAX_PASS2_V, pass1Taxonomy, pass2Taxonomy } from '../prompts.js';
import { type Settings, getSettings } from '../settings.js';
import { callClaude } from './_shared.js';
import {
	Pass1TaxResultSchema,
	RawArgUnitSchema,
	SynthesisResultSchema,
	type Pass1TaxResult,
	type TaxonomyExtraction,
} from '../taxonomy-models.js';

function _hash(...parts: string[]): string {
	return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

// ── Pass 1 tool schema ─────────────────────────────────────────────────────────

const Pass1ToolSchema = z.object({
	units: z.array(RawArgUnitSchema),
});

// ── Pass 2 tool schema ─────────────────────────────────────────────────────────

const Pass2ToolSchema = SynthesisResultSchema;

// ── Pass 1 — per-source extraction ────────────────────────────────────────────

async function _pass1One(
	source: Source,
	query: string,
	client: Anthropic,
	cache: KPACache,
	forceRefresh: boolean,
	settings: Settings,
): Promise<Pass1TaxResult | null> {
	const key = `claude:tax:p1:${TAX_PASS1_V}:${_hash(source.content, query)}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			log.debug({ url: source.url }, 'tax_pass1_cache_hit');
			return Pass1TaxResultSchema.parse(hit.data);
		}
	}

	try {
		const raw = await callClaude(
			client,
			pass1Taxonomy(source, query),
			'submit_argument_units',
			'Submit all extracted argument units from this article.',
			Pass1ToolSchema,
			settings,
			8192,
		);
		const { units } = Pass1ToolSchema.parse(raw);
		const result: Pass1TaxResult = {
			sourceUrl: source.url,
			sourceAuthor: source.author ?? null,
			sourceOutlet: source.outlet ?? null,
			sourceTitle: source.title ?? null,
			units,
		};
		cache.set(key, result);
		log.debug({ url: source.url, nUnits: units.length }, 'tax_pass1_complete');
		return result;
	} catch (err) {
		log.warn({ url: source.url, err }, 'tax_pass1_failed');
		return null;
	}
}

// ── Pass 2 — issue / proposal synthesis ───────────────────────────────────────

async function _pass2(
	pass1Results: Pass1TaxResult[],
	query: string,
	client: Anthropic,
	cache: KPACache,
	forceRefresh: boolean,
	settings: Settings,
): Promise<z.infer<typeof SynthesisResultSchema>> {
	// Compress units: send only structural hints to Pass 2 (not full textSpans)
	const flatUnits = pass1Results.flatMap((p1) =>
		p1.units.map((u) => ({
			argType: u.argType,
			claimSummary: u.claimSummary,
			issueHint: u.issueHint ?? null,
			proposalHint: u.proposalHint ?? null,
			position: u.position ?? null,
			centrality: u.centrality,
		})),
	);

	const compressed = JSON.stringify(flatUnits, null, 2);
	const key = `claude:tax:p2:${TAX_PASS2_V}:${_hash(query, compressed)}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			log.debug({ query }, 'tax_pass2_cache_hit');
			return SynthesisResultSchema.parse(hit.data);
		}
	}

	const raw = await callClaude(
		client,
		pass2Taxonomy(query, compressed),
		'submit_synthesis',
		'Submit the canonical issue graph, proposal nodes, and unit linkages.',
		Pass2ToolSchema,
		settings,
		8192,
	);

	const result = SynthesisResultSchema.parse(raw);
	cache.set(key, result);
	log.info(
		{ query, nIssues: result.issues.length, nProposals: result.proposals.length },
		'tax_pass2_complete',
	);
	return result;
}

// ── Public entry point ─────────────────────────────────────────────────────────

export async function extractTaxonomy(
	sources: Source[],
	query: string,
	strategy: string,
	numSources: number,
	forceRefresh = false,
	opts: { cache?: KPACache; settings?: Settings } = {},
): Promise<TaxonomyExtraction> {
	const cache = opts.cache ?? getCache();
	const settings = opts.settings ?? getSettings();
	const client = new Anthropic({ apiKey: settings.anthropicApiKey });

	// Pass 1 — parallel, one call per source
	const pass1Results = (
		await Promise.allSettled(
			sources.map((src) => _pass1One(src, query, client, cache, forceRefresh, settings)),
		)
	)
		.filter(
			(r): r is PromiseFulfilledResult<Pass1TaxResult> =>
				r.status === 'fulfilled' && r.value !== null,
		)
		.map((r) => r.value);

	log.info({ query, nSources: pass1Results.length }, 'tax_pass1_all_complete');

	if (pass1Results.length === 0) {
		log.warn({ query }, 'tax_no_pass1_results');
		return {
			query,
			strategy,
			numSources,
			pass1Results: [],
			synthesis: { issues: [], proposals: [], unitLinkages: [] },
		};
	}

	// Pass 2 — synthesis
	const synthesis = await _pass2(pass1Results, query, client, cache, forceRefresh, settings);

	return { query, strategy, numSources, pass1Results, synthesis };
}
