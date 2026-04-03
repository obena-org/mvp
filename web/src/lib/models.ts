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

export interface KPAResult {
	query: string;
	strategy: 'bottom-up' | 'top-down';
	keyPoints: KeyPoint[];
	sourcesAnalyzed: number;
	generatedAt: string;
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
