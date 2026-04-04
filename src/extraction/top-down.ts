/**
 * Top-down extraction strategy.
 *
 * Pass 1 (single call): identify key points from article summaries.
 * Pass 2 (single call): find supporting quotes for each key point.
 *
 * Mirrors rnd-kpa/src/rnd_kpa/extraction/top_down.py.
 */

import { createHash } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { type KPACache, getCache } from '../cache.js';
import { log } from '../logger.js';
import {
	KeyPointSchema,
	QuoteSchema,
	type KeyPoint,
	type OnProgress,
	type Source,
} from '../models.js';
import { PASS1_TD_V, PASS2_TD_V, pass1TopDown, pass2TopDown } from '../prompts.js';
import { type Settings, getSettings } from '../settings.js';

function _hash(...parts: string[]): string {
	return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

const _SUMMARY_LIMIT = 500;
const _CONTENT_LIMIT = 3_000;

// ── Intermediate schemas ───────────────────────────────────────────────────────

const RawKeyPointSchema = z.object({ title: z.string(), description: z.string() });
const Pass1ResultSchema = z.object({ keyPoints: z.array(RawKeyPointSchema) });
type RawKeyPoint = z.infer<typeof RawKeyPointSchema>;

const Pass2ResultSchema = z.object({
	keyPoints: z.array(
		z.object({ title: z.string(), summary: z.string(), quotes: z.array(QuoteSchema) }),
	),
});

// ── Claude helper (shared pattern with bottom-up) ──────────────────────────────

function _zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	const def = schema._def;
	if (def.typeName === 'ZodObject') {
		const shape = def.shape();
		const properties: Record<string, unknown> = {};
		const required: string[] = [];
		for (const [k, v] of Object.entries(shape)) {
			properties[k] = _zodToJsonSchema(v as z.ZodTypeAny);
			if (!(v as z.ZodTypeAny).isOptional()) required.push(k);
		}
		return { type: 'object', properties, required };
	}
	if (def.typeName === 'ZodArray') {
		return { type: 'array', items: _zodToJsonSchema(def.type) };
	}
	if (def.typeName === 'ZodString') return { type: 'string' };
	if (def.typeName === 'ZodNullable' || def.typeName === 'ZodOptional') {
		return _zodToJsonSchema(def.innerType);
	}
	return {};
}

async function _callClaude(
	client: Anthropic,
	prompt: string,
	toolName: string,
	toolDescription: string,
	schema: z.ZodTypeAny,
	settings: Settings,
): Promise<Record<string, unknown>> {
	const response = await client.messages.create({
		model: settings.claudeModel,
		max_tokens: 4096,
		tools: [
			{
				name: toolName,
				description: toolDescription,
				input_schema: _zodToJsonSchema(schema) as Anthropic.Tool['input_schema'],
			},
		],
		tool_choice: { type: 'tool', name: toolName },
		messages: [{ role: 'user', content: prompt }],
	});

	const block = response.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') {
		throw new Error('Claude did not return a tool_use block');
	}
	return block.input as Record<string, unknown>;
}

// ── Pass 1 ────────────────────────────────────────────────────────────────────

async function _pass1(
	sources: Source[],
	query: string,
	client: Anthropic,
	cache: KPACache,
	forceRefresh: boolean,
	settings: Settings,
): Promise<RawKeyPoint[]> {
	const sourcesData = [...sources]
		.sort((a, b) => a.url.localeCompare(b.url))
		.map((s) => ({ url: s.url, title: s.title, author: s.author, content: s.content }));

	const key = `claude:td:p1:${PASS1_TD_V}:${_hash(query, JSON.stringify(sourcesData))}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			log.debug({ query }, 'td_pass1_cache_hit');
			const payload = hit.data as { keyPoints: unknown[] };
			return payload.keyPoints.map((kp) => RawKeyPointSchema.parse(kp));
		}
	}

	const summaries = sources
		.map((s) => `[${s.outlet ?? s.url}] ${s.title ?? ''}\n${s.content.slice(0, _SUMMARY_LIMIT)}`)
		.join('\n---\n');

	const result = await _callClaude(
		client,
		pass1TopDown(query, summaries),
		'submit_key_points',
		'Submit the identified key points from these articles.',
		Pass1ResultSchema,
		settings,
	);

	const rawKps = Pass1ResultSchema.parse(result).keyPoints;
	cache.set(key, { keyPoints: rawKps });
	log.info({ query, nKeyPoints: rawKps.length }, 'td_pass1_complete');
	return rawKps;
}

// ── Pass 2 ────────────────────────────────────────────────────────────────────

async function _pass2(
	rawKps: RawKeyPoint[],
	sources: Source[],
	query: string,
	client: Anthropic,
	cache: KPACache,
	forceRefresh: boolean,
	settings: Settings,
): Promise<KeyPoint[]> {
	const kpsJson = JSON.stringify(rawKps, null, 2);
	const sourcesData = [...sources]
		.sort((a, b) => a.url.localeCompare(b.url))
		.map((s) => ({ url: s.url, author: s.author, outlet: s.outlet, content: s.content }));

	const key = `claude:td:p2:${PASS2_TD_V}:${_hash(query, kpsJson, JSON.stringify(sourcesData))}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			log.debug({ query }, 'td_pass2_cache_hit');
			const payload = hit.data as { keyPoints: unknown[] };
			return payload.keyPoints.map((kp) => KeyPointSchema.parse(kp));
		}
	}

	const articlesContent = sources
		.map((s) =>
			[
				`URL: ${s.url}`,
				s.author ? `Author: ${s.author}` : null,
				s.outlet ? `Outlet: ${s.outlet}` : null,
				s.content.slice(0, _CONTENT_LIMIT),
			]
				.filter(Boolean)
				.join('\n'),
		)
		.join('\n---\n');

	const result = await _callClaude(
		client,
		pass2TopDown(query, kpsJson, articlesContent),
		'submit_key_points_with_quotes',
		'Submit key points with supporting quotes from the provided articles.',
		Pass2ResultSchema,
		settings,
	);

	const keyPoints = Pass2ResultSchema.parse(result).keyPoints.map((kp) => KeyPointSchema.parse(kp));
	cache.set(key, { keyPoints });
	log.info({ query, nKeyPoints: keyPoints.length }, 'td_pass2_complete');
	return keyPoints;
}

// ── Public entry point ─────────────────────────────────────────────────────────

export async function extract(
	sources: Source[],
	query: string,
	forceRefresh = false,
	opts: { cache?: KPACache; settings?: Settings; onProgress?: OnProgress } = {},
): Promise<KeyPoint[]> {
	const { onProgress } = opts;
	const cache = opts.cache ?? getCache();
	const settings = opts.settings ?? getSettings();
	const client = new Anthropic({ apiKey: settings.anthropicApiKey });

	const rawKps = await _pass1(sources, query, client, cache, forceRefresh, settings);
	if (rawKps.length === 0) {
		log.warn({ query }, 'no_key_points_identified');
		return [];
	}

	onProgress?.({ type: 'status', phase: 'synthesizing', message: 'Retrieving supporting quotes…' });
	return _pass2(rawKps, sources, query, client, cache, forceRefresh, settings);
}
