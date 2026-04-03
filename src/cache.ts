/**
 * Disk-backed cache using one JSON file per entry.
 * Mirrors rnd-kpa/src/rnd_kpa/cache.py.
 *
 * Entry format: { data: unknown, storedAt: ISO string, expiresAt?: ISO string }
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
