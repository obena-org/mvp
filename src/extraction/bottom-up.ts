/**
 * Bottom-up extraction strategy.
 *
 * Pass 1 (parallel): extract quotes + claim labels from each source via Claude.
 * Pass 2 (single call): synthesize all candidates into coherent key points.
 *
 * Mirrors rnd-kpa/src/rnd_kpa/extraction/bottom_up.py.
 */

import { createHash } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { type KPACache, getCache } from '../cache.js';
import { log } from '../logger.js';
import type { KeyPoint, OnProgress, Source } from '../models.js';
import { KeyPointSchema, QuoteSchema } from '../models.js';
import { PASS1_BU_V, PASS2_BU_V, pass1BottomUp, pass2BottomUp } from '../prompts.js';
import { type Settings, getSettings } from '../settings.js';

function _hash(...parts: string[]): string {
	return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

// ── Intermediate schemas ───────────────────────────────────────────────────────

const CandidateQuoteSchema = z.object({ text: z.string(), claim: z.string() });
const QuoteListSchema = z.object({ quotes: z.array(CandidateQuoteSchema) });

const Pass1ResultSchema = z.object({
	sourceUrl: z.string(),
	sourceAuthor: z.string().nullish(),
	sourceOutlet: z.string().nullish(),
	quotes: z.array(CandidateQuoteSchema),
});
type Pass1Result = z.infer<typeof Pass1ResultSchema>;

const Pass2ResultSchema = z.object({
	keyPoints: z.array(
		z.object({ title: z.string(), summary: z.string(), quotes: z.array(QuoteSchema) }),
	),
});

// ── Claude helper ──────────────────────────────────────────────────────────────

function _zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	// Minimal JSON Schema extraction — sufficient for Anthropic tool_use.
	// For production use, consider zod-to-json-schema package.
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

async function _pass1One(
	source: Source,
	client: Anthropic,
	cache: KPACache,
	forceRefresh: boolean,
	settings: Settings,
): Promise<Pass1Result | null> {
	const key = `claude:bu:p1:${PASS1_BU_V}:${_hash(source.content)}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			log.debug({ url: source.url }, 'pass1_cache_hit');
			return Pass1ResultSchema.parse(hit.data);
		}
	}

	try {
		const result = await _callClaude(
			client,
			pass1BottomUp(source),
			'submit_quotes',
			'Submit extracted quotes and claims from this article.',
			QuoteListSchema,
			settings,
		);
		const rawQuotes = QuoteListSchema.parse(result).quotes;
		const pass1: Pass1Result = {
			sourceUrl: source.url,
			sourceAuthor: source.author ?? null,
			sourceOutlet: source.outlet ?? null,
			quotes: rawQuotes,
		};
		cache.set(key, pass1);
		log.debug({ url: source.url, nQuotes: pass1.quotes.length }, 'pass1_complete');
		return pass1;
	} catch (err) {
		log.warn({ url: source.url, err }, 'pass1_failed');
		return null;
	}
}

// ── Pass 2 ────────────────────────────────────────────────────────────────────

async function _pass2(
	pass1Results: Pass1Result[],
	query: string,
	client: Anthropic,
	cache: KPACache,
	forceRefresh: boolean,
	settings: Settings,
): Promise<KeyPoint[]> {
	const candidates = pass1Results
		.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl))
		.map((r) => ({
			source_url: r.sourceUrl,
			author: r.sourceAuthor,
			outlet: r.sourceOutlet,
			quotes: r.quotes.map((q) => ({ text: q.text, claim: q.claim })),
		}));

	const combined = JSON.stringify(candidates);
	const key = `claude:bu:p2:${PASS2_BU_V}:${_hash(query, combined)}`;

	if (!forceRefresh) {
		const hit = cache.get(key);
		if (hit !== null) {
			log.debug({ query }, 'pass2_cache_hit');
			const payload = hit.data as { keyPoints: unknown[] };
			return payload.keyPoints.map((kp) => KeyPointSchema.parse(kp));
		}
	}

	const result = await _callClaude(
		client,
		pass2BottomUp(query, JSON.stringify(candidates, null, 2)),
		'submit_key_points',
		'Submit synthesized key points with supporting quotes.',
		Pass2ResultSchema,
		settings,
	);

	const keyPoints = Pass2ResultSchema.parse(result).keyPoints.map((kp) => KeyPointSchema.parse(kp));
	cache.set(key, { keyPoints });
	log.info({ query, nKeyPoints: keyPoints.length }, 'pass2_complete');
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

	const total = sources.length;
	let completed = 0;

	// Pass 1 — parallel; emit source-done as each settles
	const pass1Results = (
		await Promise.allSettled(
			sources.map(async (src) => {
				const result = await _pass1One(src, client, cache, forceRefresh, settings);
				completed += 1;
				onProgress?.({ type: 'source-done', completed, total, url: src.url, ok: result !== null });
				return result;
			}),
		)
	)
		.filter(
			(r): r is PromiseFulfilledResult<Pass1Result> => r.status === 'fulfilled' && r.value !== null,
		)
		.map((r) => r.value);

	if (pass1Results.length === 0) {
		log.warn({ query }, 'no_pass1_results');
		return [];
	}

	// Pass 2 — synthesis
	onProgress?.({ type: 'status', phase: 'synthesizing', message: 'Synthesising key points…' });
	return _pass2(pass1Results, query, client, cache, forceRefresh, settings);
}
