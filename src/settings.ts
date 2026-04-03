/**
 * Runtime configuration from config/.env.secrets and environment variables.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const _ROOT = resolve(fileURLToPath(import.meta.url), '../../');

dotenv.config({ path: resolve(_ROOT, 'config/.env.secrets') });

const SettingsSchema = z.object({
	anthropicApiKey: z.string().min(1),
	firecrawlApiKey: z.string().min(1),
	cacheDir: z.string().default(resolve(_ROOT, '.cache/kpa')),
	searchCacheTtlSeconds: z.coerce.number().default(7 * 24 * 3600),
	numSources: z.coerce.number().default(20),
	claudeModel: z.string().default('claude-sonnet-4-6'),
});

export type Settings = z.infer<typeof SettingsSchema>;

const ENV_VAR_BY_SETTING_KEY: Record<string, string> = {
	anthropicApiKey: 'ANTHROPIC_API_KEY',
	firecrawlApiKey: 'FIRECRAWL_API_KEY',
};

/** Thrown when required configuration is missing or invalid (CLI prints message without stack). */
export class ConfigError extends Error {
	override readonly name = 'ConfigError';
	constructor(message: string) {
		super(message);
	}
}

function loadSettings(): Settings {
	const raw = {
		anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
		firecrawlApiKey: process.env['FIRECRAWL_API_KEY'],
		cacheDir: process.env['CACHE_DIR'],
		searchCacheTtlSeconds: process.env['SEARCH_CACHE_TTL_SECONDS'],
		numSources: process.env['NUM_SOURCES'],
		claudeModel: process.env['CLAUDE_MODEL'],
	};
	const result = SettingsSchema.safeParse(raw);
	if (!result.success) {
		const missingEnv = result.error.issues
			.filter((i) => i.path[0] !== undefined && ENV_VAR_BY_SETTING_KEY[String(i.path[0])])
			.map((i) => ENV_VAR_BY_SETTING_KEY[String(i.path[0])]);
		const unique = [...new Set(missingEnv)];
		const hint =
			unique.length > 0
				? `Set these environment variables (e.g. in config/.env.secrets — copy from config/.env.secrets.example):\n  ${unique.join(', ')}`
				: result.error.message;
		throw new ConfigError(hint);
	}
	return result.data;
}

let _settings: Settings | undefined;

export function getSettings(): Settings {
	if (_settings === undefined) {
		_settings = loadSettings();
	}
	return _settings;
}

/** Reset singleton — for testing only. */
export function resetSettings(): void {
	_settings = undefined;
}
