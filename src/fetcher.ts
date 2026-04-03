/**
 * Firecrawl search wrapper with disk caching.
 * Mirrors rnd-kpa/src/rnd_kpa/fetcher.py.
 *
 * Cache key includes _OPINION_FILTER_V so bumping the filter string
 * automatically invalidates stale search results.
 */

import { createHash } from 'node:crypto';

import FirecrawlApp from '@mendable/firecrawl-js';

import { type KPACache, getCache } from './cache.js';
import { log } from './logger.js';
import { SourceSchema, type Source } from './models.js';
import { type Settings, getSettings } from './settings.js';

// Appended to every query to bias results toward op-ed/opinion content.
// Bump _OPINION_FILTER_V whenever this string changes to invalidate cached searches.
const _OPINION_FILTER =
	'(inurl:opinion OR inurl:oped OR inurl:editorials OR inurl:commentisfree' +
	' OR inurl:ideas/ OR inurl:op-ed/ OR inurl:commentary' +
	' OR intitle:opinion OR intitle:editorial) -inurl:video/';
const _OPINION_FILTER_V = 'v1';

const _MIN_CONTENT_CHARS = 800;
const _MIN_PATH_DEPTH = 3;

function _hash(...parts: string[]): string {
	return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

function _urlPathDepth(url: string): number {
	try {
		return new URL(url).pathname.split('/').filter(Boolean).length;
	} catch {
		return 0;
	}
}

function _extractOutlet(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, '') || null;
	} catch {
		return null;
	}
}

function _metadataGet(metadata: Record<string, unknown>, ...keys: string[]): string | null {
	for (const key of keys) {
		const val = metadata[key];
		if (val && typeof val === 'string') return val;
	}
	return null;
}

// biome-ignore lint/suspicious/noExplicitAny: Firecrawl SDK returns untyped metadata
function _parseDocuments(items: any[]): Source[] {
	const sources: Source[] = [];
	for (const item of items) {
		const url: string = item.metadata?.url ?? item.metadata?.sourceURL ?? item.url ?? '';
		const content: string = item.markdown ?? '';

		if (!url || !content.trim()) continue;

		const depth = _urlPathDepth(url);
		if (depth < _MIN_PATH_DEPTH) {
			log.debug({ url, pathDepth: depth }, 'source_filtered_shallow_url');
			continue;
		}

		if (content.length < _MIN_CONTENT_CHARS) {
			log.debug({ url, contentLen: content.length }, 'source_filtered_short_content');
			continue;
		}

		const meta: Record<string, unknown> = item.metadata ?? {};
		sources.push(
			SourceSchema.parse({
				url,
				title: _metadataGet(meta, 'title') ?? null,
				author: _metadataGet(meta, 'author', 'og:author') ?? null,
				outlet:
					_metadataGet(meta, 'ogSiteName', 'og:site_name', 'og_site_name', 'siteName') ??
					_extractOutlet(url),
				content,
			}),
		);
	}
	return sources;
}

export async function searchSources(
	query: string,
	numSources: number,
	forceRefresh = false,
	opts: { cache?: KPACache; settings?: Settings } = {},
): Promise<{ sources: Source[]; fetchedAt: Date; cacheHit: boolean }> {
	const cache = opts.cache ?? getCache();
	const settings = opts.settings ?? getSettings();

	const key = `fc:search:${_hash(query, String(numSources), _OPINION_FILTER_V)}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			const sources = (hit.data as object[]).map((s) => SourceSchema.parse(s));
			log.debug({ query, n: sources.length }, 'firecrawl_cache_hit');
			return { sources, fetchedAt: hit.storedAt, cacheHit: true };
		}
	}

	const firecrawlQuery = `${query} ${_OPINION_FILTER}`;
	log.info({ query, numSources }, 'firecrawl_search');

	const client = new FirecrawlApp({ apiKey: settings.firecrawlApiKey });
	const result = await client.search(firecrawlQuery, {
		limit: numSources,
		scrapeOptions: { formats: ['markdown'] },
	});

	// result.data is the array of scraped documents
	// biome-ignore lint/suspicious/noExplicitAny: Firecrawl SDK type varies by version
	const items: any[] = (result as any).data ?? [];
	const sources = _parseDocuments(items);

	const fetchedAt = cache.set(
		key,
		sources.map((s) => s),
		settings.searchCacheTtlSeconds,
	);
	log.info({ query, n: sources.length }, 'firecrawl_search_complete');
	return { sources, fetchedAt, cacheHit: false };
}
