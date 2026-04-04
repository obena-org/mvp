/**
 * Plain TypeScript interfaces mirroring src/models.ts (Zod schemas).
 * These are the only types imported by the SvelteKit client — no Zod runtime in the browser.
 */

export interface Quote {
	text: string;
	author?: string | null;
	outlet?: string | null;
	url: string;
}

export interface KeyPoint {
	title: string;
	summary: string;
	quotes: Quote[];
}

export interface SourceUsage {
	url: string;
	title: string | null;
	outlet: string | null;
	quoteCount: number;
	keyPointCount: number;
}

export interface KPAResult {
	query: string;
	strategy: 'bottom-up' | 'top-down';
	keyPoints: KeyPoint[];
	sourcesAnalyzed: number;
	sourceUsage: SourceUsage[];
	generatedAt: string;
	/** ISO time of Firecrawl search (or cached search entry). */
	searchFetchedAt: string;
	cacheHit: boolean;
}

export interface KPARequest {
	topic: string;
	options?: {
		strategy?: 'bottom-up' | 'top-down';
		numSources?: number;
		forceRefresh?: boolean;
	};
}

export interface KPAErrorResponse {
	error: string;
}

export type ProgressPhase = 'searching' | 'processing' | 'synthesizing';

export type ProgressEvent =
	| { type: 'status'; phase: ProgressPhase; message: string }
	| { type: 'source-done'; completed: number; total: number; url: string; ok: boolean }
	| { type: 'cache-hit'; result: KPAResult }
	| { type: 'complete'; result: KPAResult }
	| { type: 'error'; message: string };
