/**
 * KPA pipeline orchestrator.
 * Mirrors rnd-kpa/src/rnd_kpa/pipeline.py.
 */

import { type KPACache, getCache } from './cache.js';
import { extract as extractBottomUp } from './extraction/bottom-up.js';
import { extract as extractTopDown } from './extraction/top-down.js';
import { searchSources } from './fetcher.js';
import { log } from './logger.js';
import {
	KPAResultSchema,
	type KeyPoint,
	type KPAResult,
	type Quote,
	type Source,
} from './models.js';
import { type Settings, getSettings } from './settings.js';

/**
 * For each quote, if its URL matches a fetched source, prefer that source's
 * scraped author/outlet (HTML + metadata) over whatever the extraction model put
 * on the quote — so bylines reflect Unfluff/JSON-LD, not inferred names.
 */
export function applySourceAttribution(keyPoints: KeyPoint[], sources: Source[]): KeyPoint[] {
	const byUrl = new Map(sources.map((s) => [s.url, s] as const));
	return keyPoints.map((kp) => ({
		...kp,
		quotes: kp.quotes.map((q) => _mergeQuoteAttribution(q, byUrl.get(q.url))),
	}));
}

function _mergeQuoteAttribution(q: Quote, src: Source | undefined): Quote {
	if (!src) return q;
	const author = src.author != null && src.author !== '' ? src.author : q.author;
	const outlet = src.outlet != null && src.outlet !== '' ? src.outlet : q.outlet;
	return { ...q, author, outlet };
}

export async function runKpa(
	query: string,
	strategy: 'bottom-up' | 'top-down' = 'bottom-up',
	numSources?: number,
	forceRefresh = false,
	opts: { cache?: KPACache; settings?: Settings } = {},
): Promise<KPAResult> {
	const cache = opts.cache ?? getCache();
	const settings = opts.settings ?? getSettings();
	const n = numSources ?? settings.numSources;

	log.info({ query, strategy, numSources: n }, 'pipeline_start');

	const { sources, cacheHit: searchCacheHit } = await searchSources(query, n, forceRefresh, {
		cache,
		settings,
	});

	if (sources.length === 0) {
		log.warn({ query }, 'no_sources_found');
		return KPAResultSchema.parse({
			query,
			strategy,
			keyPoints: [],
			sourcesAnalyzed: 0,
			generatedAt: new Date().toISOString(),
			cacheHit: searchCacheHit,
		});
	}

	const extractor = strategy === 'bottom-up' ? extractBottomUp : extractTopDown;
	const keyPoints = applySourceAttribution(
		await extractor(sources, query, forceRefresh, { cache, settings }),
		sources,
	);

	const result = KPAResultSchema.parse({
		query,
		strategy,
		keyPoints,
		sourcesAnalyzed: sources.length,
		generatedAt: new Date().toISOString(),
		cacheHit: searchCacheHit,
	});

	log.info({ query, nKeyPoints: keyPoints.length }, 'pipeline_complete');
	return result;
}
