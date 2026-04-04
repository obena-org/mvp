/**
 * Firecrawl search wrapper with disk caching.
 * Mirrors rnd-kpa/src/rnd_kpa/fetcher.py.
 *
 * Cache key includes _OPINION_FILTER_V (search query semantics) and
 * _SOURCE_SCHEMA_V (shape of the stored Source object) so that either
 * kind of change independently invalidates stale cache entries.
 */

import { createHash } from 'node:crypto';

import FirecrawlApp from '@mendable/firecrawl-js';
import unfluff from 'unfluff';

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

// Bump _SOURCE_SCHEMA_V whenever the shape of a cached Source object changes
// (e.g. new fields populated, normalization rules updated). This is independent
// of _OPINION_FILTER_V; do NOT conflate them.
const _SOURCE_SCHEMA_V = 'v4'; // v4: Firecrawl onlyMainContent:false for byline/JSON-LD; congressional outlet fix

const _MIN_CONTENT_CHARS = 800;
const _MIN_PATH_DEPTH = 3;

// Author strings that are clearly not a real person name and must be rejected.
const _AUTHOR_REJECT = new Set([
	'by', // bare byline marker without following name
	'staff',
	'editors',
	'editorial board',
	'editorial staff',
	'wire services',
	'associated press',
	'reuters',
	'ap',
]);

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

/** Prefer hostname for `*.house.gov` / `*.senate.gov` — og:site_name is often the member's name. */
function _resolveOutlet(url: string, metaSiteName: string | null): string | null {
	try {
		const hostname = new URL(url).hostname.toLowerCase();
		if (hostname.endsWith('.house.gov') || hostname.endsWith('.senate.gov')) {
			return _extractOutlet(url);
		}
	} catch {
		// fall through
	}
	return metaSiteName ?? _extractOutlet(url);
}

function _metadataGet(metadata: Record<string, unknown>, ...keys: string[]): string | null {
	for (const key of keys) {
		const val = metadata[key];
		if (val && typeof val === 'string') return val;
	}
	return null;
}

/** Extract author name from a single parsed JSON-LD object (handles @graph, arrays, plain objects). */
function _jsonLdAuthorName(obj: unknown): string | null {
	if (!obj || typeof obj !== 'object') return null;
	const o = obj as Record<string, unknown>;

	// Recurse into @graph arrays (common in news site structured data)
	const graph = o['@graph'];
	if (Array.isArray(graph)) {
		for (const item of graph) {
			const name = _jsonLdAuthorName(item);
			if (name) return name;
		}
	}

	const author = o['author'];
	if (!author) return null;
	if (typeof author === 'string') return author || null;

	if (Array.isArray(author)) {
		const first: unknown = author[0];
		if (first === undefined || first === null) return null;
		if (typeof first === 'string') return first || null;
		if (typeof first === 'object') {
			const name = (first as Record<string, unknown>)['name'];
			return typeof name === 'string' && name ? name : null;
		}
		return null;
	}

	if (typeof author === 'object') {
		const name = (author as Record<string, unknown>)['name'];
		return typeof name === 'string' && name ? name : null;
	}
	return null;
}

/**
 * Extract author from JSON-LD `<script type="application/ld+json">` blocks in the HTML.
 * Returns the first valid author name found, or null.
 * Exported for unit testing.
 */
export function _extractJsonLdAuthor(html: string): string | null {
	const scriptRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = scriptRe.exec(html)) !== null) {
		const text = m[1];
		if (!text) continue;
		try {
			const author = _jsonLdAuthorName(JSON.parse(text) as unknown);
			if (author) return author;
		} catch {
			// malformed JSON-LD — skip
		}
	}
	return null;
}

/**
 * Normalize a raw author value from Unfluff (string[]) or metadata (string).
 * Iterates candidates in order; returns the first one that passes normalization.
 *
 * Per-candidate rules:
 * - Trim whitespace; strip leading "By " (case-insensitive)
 * - If the value looks like a URL, attempt to extract a name from a "/by/{slug}" path
 *   (e.g. "https://www.nytimes.com/by/david-brooks" → "David Brooks"); reject if no /by/ segment
 * - Reject known placeholders and outlet-name matches
 * - Otherwise return as-is (preserve capitalization, multi-author strings, role suffixes)
 *
 * Exported for unit testing.
 */
export function _normalizeAuthor(
	raw: string | string[] | null | undefined,
	outlet: string | null | undefined,
): string | null {
	const candidates: string[] = Array.isArray(raw)
		? raw
		: raw !== undefined && raw !== null
			? [raw]
			: [];
	for (const candidate of candidates) {
		const result = _normalizeSingle(candidate, outlet);
		if (result !== null) return result;
	}
	return null;
}

function _normalizeSingle(raw: string, outlet: string | null | undefined): string | null {
	let s = raw.trim();
	if (!s) return null;

	// Social media handles (e.g. "@nypost", "@RalphOrtega") — not displayable names.
	if (s.startsWith('@')) return null;

	// URL-shaped author (e.g. "https://www.nytimes.com/by/david-brooks") —
	// extract the /by/{slug} segment and title-case it; reject if no /by/ path.
	if (/^https?:\/\//i.test(s)) {
		const bySlug = s.match(/\/by\/([^/?#]+)/i)?.[1];
		if (!bySlug) return null;
		s = bySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	s = s.replace(/^by\s+/i, '').trim();
	if (!s) return null;

	const lower = s.toLowerCase();
	if (_AUTHOR_REJECT.has(lower)) return null;
	if (outlet && lower === outlet.toLowerCase()) return null;
	return s;
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
		const metaSiteName = _metadataGet(
			meta,
			'ogSiteName',
			'og:site_name',
			'og_site_name',
			'siteName',
		);
		const outlet = _resolveOutlet(url, metaSiteName);

		// ── Author resolution: Unfluff → JSON-LD → metadata → null ──────────
		let unfluffAuthor: string | null = null;
		let jsonLdAuthor: string | null = null;
		let metaAuthor: string | null = null;

		const html: string = item.html ?? '';
		if (html) {
			log.debug({ url }, 'source_html_present');
			try {
				const extracted = unfluff(html);
				unfluffAuthor = _normalizeAuthor(extracted.author, outlet);
				if (unfluffAuthor) log.debug({ url, author: unfluffAuthor }, 'source_author_unfluff');
			} catch (err) {
				log.debug({ url, err }, 'source_unfluff_error');
			}

			if (!unfluffAuthor) {
				jsonLdAuthor = _normalizeAuthor(_extractJsonLdAuthor(html), outlet);
				if (jsonLdAuthor) log.debug({ url, author: jsonLdAuthor }, 'source_author_jsonld');
			}
		}

		metaAuthor = _normalizeAuthor(
			_metadataGet(
				meta,
				'author',
				'og:author',
				'article:author',
				'parsely-author',
				'twitter:creator',
			),
			outlet,
		);
		if (metaAuthor) log.debug({ url, author: metaAuthor }, 'source_author_metadata');

		const htmlAuthor = unfluffAuthor ?? jsonLdAuthor;
		if (htmlAuthor && metaAuthor && htmlAuthor !== metaAuthor) {
			log.debug({ url, html: htmlAuthor, metadata: metaAuthor }, 'source_author_conflict');
		}

		const author = unfluffAuthor ?? jsonLdAuthor ?? metaAuthor;
		if (!author) log.debug({ url }, 'source_author_null');
		// ──────────────────────────────────────────────────────────────────────

		sources.push(
			SourceSchema.parse({
				url,
				title: _metadataGet(meta, 'title') ?? null,
				author,
				outlet,
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

	const key = `fc:search:${_hash(query, String(numSources), _OPINION_FILTER_V, _SOURCE_SCHEMA_V)}`;

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
		// `true` (Firecrawl default) strips head/bylines — Unfluff/JSON-LD then miss real authors.
		scrapeOptions: { formats: ['markdown', 'html'], onlyMainContent: false },
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
