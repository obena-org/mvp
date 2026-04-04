/**
 * Disk-backed cache using one JSON file per entry.
 * Mirrors rnd-kpa/src/rnd_kpa/cache.py.
 *
 * Entry format: { data: unknown, storedAt: ISO string, expiresAt?: ISO string }
 *
 * Also manages query_history.json — a flat log of recent KPA queries.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getSettings } from './settings.js';

interface CacheEntry {
	data: unknown;
	storedAt: string;
	expiresAt?: string;
}

export interface CacheHit {
	data: unknown;
	storedAt: Date;
}

function _keyToPath(cacheDir: string, key: string): string {
	const hash = createHash('sha256').update(key).digest('hex').slice(0, 32);
	return join(cacheDir, `${hash}.json`);
}

export class KPACache {
	private readonly dir: string;

	constructor(cacheDir: string) {
		this.dir = cacheDir;
		mkdirSync(cacheDir, { recursive: true });
	}

	get(key: string): CacheHit | null {
		const path = _keyToPath(this.dir, key);
		if (!existsSync(path)) return null;
		try {
			const entry: CacheEntry = JSON.parse(readFileSync(path, 'utf8'));
			if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
				return null; // expired
			}
			return { data: entry.data, storedAt: new Date(entry.storedAt) };
		} catch {
			return null;
		}
	}

	set(key: string, data: unknown, ttlSeconds?: number): Date {
		const storedAt = new Date();
		const entry: CacheEntry = { data, storedAt: storedAt.toISOString() };
		if (ttlSeconds !== undefined) {
			entry.expiresAt = new Date(storedAt.getTime() + ttlSeconds * 1000).toISOString();
		}
		writeFileSync(_keyToPath(this.dir, key), JSON.stringify(entry), 'utf8');
		return storedAt;
	}
}

// ---------------------------------------------------------------------------
// Query history
// ---------------------------------------------------------------------------

const _HISTORY_FILE = 'query_history.json';
const _MAX_HISTORY = 50;

export interface HistoryEntry {
	query: string;
	strategy: 'bottom-up' | 'top-down';
	/** When the underlying search data was fetched (cache storedAt for hits, now for fresh). */
	searchFetchedAt: string;
}

/** Prepend an entry to query_history.json, deduping by query text (case-insensitive). */
export function saveHistory(cacheDir: string, entry: HistoryEntry): void {
	mkdirSync(cacheDir, { recursive: true });
	const path = join(cacheDir, _HISTORY_FILE);
	let entries: HistoryEntry[] = [];
	try {
		entries = JSON.parse(readFileSync(path, 'utf8')) as HistoryEntry[];
	} catch {
		// file absent or corrupt — start fresh
	}
	const key = entry.query.trim().toLowerCase();
	entries = entries.filter((e) => e.query.trim().toLowerCase() !== key);
	entries = [entry, ...entries].slice(0, _MAX_HISTORY);
	writeFileSync(path, JSON.stringify(entries), 'utf8');
}

/** Read query_history.json; returns [] if absent. */
export function readHistory(cacheDir: string): HistoryEntry[] {
	const path = join(cacheDir, _HISTORY_FILE);
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as HistoryEntry[];
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------

let _cache: KPACache | undefined;

export function getCache(): KPACache {
	if (_cache === undefined) {
		_cache = new KPACache(getSettings().cacheDir);
	}
	return _cache;
}

/** Reset singleton — for testing only. */
export function resetCache(): void {
	_cache = undefined;
}
