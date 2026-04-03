/**
 * KPA pipeline orchestrator.
 * Mirrors rnd-kpa/src/rnd_kpa/pipeline.py.
 */

import { createHash } from 'node:crypto';

import { type KPACache, getCache } from './cache.js';
import { extract as extractBottomUp } from './extraction/bottom-up.js';
import { extract as extractTopDown } from './extraction/top-down.js';
import { searchSources } from './fetcher.js';
import { log } from './logger.js';
import { KPAResultSchema, type KPAResult } from './models.js';
import { type Settings, getSettings } from './settings.js';

function _hash(...parts: string[]): string {
	return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
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

	const resultKey = `kpa:result:${strategy}:${_hash(query, String(n))}`;

	if (!forceRefresh) {
		const hit = cache.get(resultKey);
		if (hit !== null) {
			log.info({ query, strategy }, 'pipeline_cache_hit');
			return KPAResultSchema.parse({ ...(hit.data as object), cacheHit: true });
		}
	}

	log.info({ query, strategy, numSources: n }, 'pipeline_start');

	const { sources } = await searchSources(query, n, forceRefresh, { cache, settings });

	if (sources.length === 0) {
		log.warn({ query }, 'no_sources_found');
		return KPAResultSchema.parse({
			query,
			strategy,
			keyPoints: [],
			sourcesAnalyzed: 0,
			generatedAt: new Date().toISOString(),
			cacheHit: false,
		});
	}

	const extractor = strategy === 'bottom-up' ? extractBottomUp : extractTopDown;
	const keyPoints = await extractor(sources, query, forceRefresh, { cache, settings });

	const result = KPAResultSchema.parse({
		query,
		strategy,
		keyPoints,
		sourcesAnalyzed: sources.length,
		generatedAt: new Date().toISOString(),
		cacheHit: false,
	});

	cache.set(resultKey, result);
	log.info({ query, nKeyPoints: keyPoints.length }, 'pipeline_complete');
	return result;
}
