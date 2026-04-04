/**
 * Canonical output schema for the KPA pipeline.
 * Mirrors rnd-kpa/src/rnd_kpa/models.py using Zod.
 */

import { z } from 'zod';

export const SourceSchema = z.object({
	url: z.string(),
	title: z.string().nullish(),
	author: z.string().nullish(),
	outlet: z.string().nullish(),
	content: z.string(),
});
export type Source = z.infer<typeof SourceSchema>;

export const QuoteSchema = z.object({
	text: z.string().min(1, 'quote text must not be empty'),
	author: z.string().nullish(),
	outlet: z.string().nullish(),
	url: z.string(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const KeyPointSchema = z.object({
	title: z.string(),
	summary: z.string(),
	quotes: z.array(QuoteSchema).min(1, 'KeyPoint must have at least one quote'),
});
export type KeyPoint = z.infer<typeof KeyPointSchema>;

export const KPAResultSchema = z.object({
	query: z.string(),
	strategy: z.enum(['bottom-up', 'top-down']),
	keyPoints: z.array(KeyPointSchema),
	sourcesAnalyzed: z.number(),
	generatedAt: z.string().datetime(),
	/** True when the Firecrawl search response was served from disk cache (not full-run cache). */
	cacheHit: z.boolean().default(false),
});
export type KPAResult = z.infer<typeof KPAResultSchema>;

// ── Progress streaming ─────────────────────────────────────────────────────────

export type ProgressEvent =
	| { type: 'status'; phase: 'searching' | 'processing' | 'synthesizing'; message: string }
	| { type: 'source-done'; completed: number; total: number; url: string; ok: boolean }
	| { type: 'cache-hit'; result: KPAResult }
	| { type: 'complete'; result: KPAResult }
	| { type: 'error'; message: string };

export type OnProgress = (event: ProgressEvent) => void;
