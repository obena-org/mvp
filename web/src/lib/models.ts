/**
 * Plain TypeScript interfaces mirroring src/models.ts (Zod schemas) and
 * src/taxonomy-models.ts. No Zod runtime in the browser.
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

export interface HistoryEntry {
	query: string;
	strategy: 'bottom-up' | 'top-down';
	/** When the underlying search data was fetched (cache storedAt for hits, now for fresh). */
	searchFetchedAt: string;
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

// ── Taxonomy / argument graph ─────────────────────────────────────────────────

export interface IssueSummary {
	id: string;
	title: string;
	description: string | null;
	domain: string | null;
	parentId: string | null;
	status: string;
}

export interface ProposalSummary {
	id: string;
	title: string;
	isBundle: boolean;
	parentId: string | null;
	status: string;
	issueId: string | null;
	actionVerb: string | null;
	claimedEnds: string | null;
	proposedMeans: string | null;
}

export interface ArgUnitSummary {
	id: string;
	argType: string;
	claimSummary: string;
	textSpan: string;
	claimRole: string;
	centrality: string;
	position: string | null;
	evidenceStyle: string | null;
	issueId: string | null;
	proposalId: string | null;
	author: string | null;
	outlet: string | null;
	sourceUrl: string;
	sourceTitle: string | null;
	targetActorName: string | null;
	issueLinkConfidence: string | null;
	proposalLinkConfidence: string | null;
}

export interface ArgGraphSummary {
	runId: string;
	query: string;
	issues: IssueSummary[];
	proposals: ProposalSummary[];
	argumentUnits: ArgUnitSummary[];
}

// ── Progress events ───────────────────────────────────────────────────────────

export type ProgressEvent =
	| { type: 'status'; phase: ProgressPhase; message: string }
	| { type: 'source-done'; completed: number; total: number; url: string; ok: boolean }
	| { type: 'cache-hit'; result: KPAResult }
	| { type: 'complete'; result: KPAResult; argGraph?: ArgGraphSummary }
	| { type: 'error'; message: string };
