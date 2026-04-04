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
	type OnProgress,
	type Quote,
	type Source,
	type SourceUsage,
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

/**
 * Builds per-source usage from fetched sources and final key points (quote URLs).
 * Order matches `sources`. Sources never cited in output show zero counts.
 */
export function computeSourceUsage(sources: Source[], keyPoints: KeyPoint[]): SourceUsage[] {
	const quoteCountByUrl = new Map<string, number>();
	const keyPointCountByUrl = new Map<string, number>();

	for (const kp of keyPoints) {
		const urlsInKp = new Set<string>();
		for (const q of kp.quotes) {
			quoteCountByUrl.set(q.url, (quoteCountByUrl.get(q.url) ?? 0) + 1);
			urlsInKp.add(q.url);
		}
		for (const u of urlsInKp) {
			keyPointCountByUrl.set(u, (keyPointCountByUrl.get(u) ?? 0) + 1);
		}
	}

	return sources.map((s) => ({
		url: s.url,
		title: s.title != null && s.title !== '' ? s.title : null,
		outlet: s.outlet != null && s.outlet !== '' ? s.outlet : null,
		quoteCount: quoteCountByUrl.get(s.url) ?? 0,
		keyPointCount: keyPointCountByUrl.get(s.url) ?? 0,
	}));
}

export async function runKpa(
	query: string,
	strategy: 'bottom-up' | 'top-down' = 'bottom-up',
	numSources?: number,
	forceRefresh = false,
	opts: { cache?: KPACache; settings?: Settings; onProgress?: OnProgress } = {},
): Promise<KPAResult> {
	const { onProgress } = opts;
	const cache = opts.cache ?? getCache();
	const settings = opts.settings ?? getSettings();
	const n = numSources ?? settings.numSources;

	log.info({ query, strategy, numSources: n }, 'pipeline_start');

	onProgress?.({ type: 'status', phase: 'searching', message: 'Searching for sources…' });

	const {
		sources,
		cacheHit: searchCacheHit,
		fetchedAt: searchFetchedAt,
	} = await searchSources(query, n, forceRefresh, {
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
			sourceUsage: [],
			generatedAt: new Date().toISOString(),
			searchFetchedAt: searchFetchedAt.toISOString(),
			cacheHit: searchCacheHit,
		});
	}

	onProgress?.({ type: 'status', phase: 'processing', message: 'Processing sources…' });

	const extractor = strategy === 'bottom-up' ? extractBottomUp : extractTopDown;
	const keyPoints = applySourceAttribution(
		await extractor(sources, query, forceRefresh, {
			cache,
			settings,
			...(onProgress !== undefined && { onProgress }),
		}),
		sources,
	);

	const result = KPAResultSchema.parse({
		query,
		strategy,
		keyPoints,
		sourcesAnalyzed: sources.length,
		sourceUsage: computeSourceUsage(sources, keyPoints),
		generatedAt: new Date().toISOString(),
		searchFetchedAt: searchFetchedAt.toISOString(),
		cacheHit: searchCacheHit,
	});

	log.info({ query, nKeyPoints: keyPoints.length }, 'pipeline_complete');
	return result;
}
