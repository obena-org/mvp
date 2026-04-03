/**
 * Public API — import this in your frontend or other TypeScript code.
 *
 * Example:
 *   import { pipeline } from "kpa-mvp";
 *   const result = await pipeline("Iran");
 */

import type { KPACache } from './cache.js';
import type { KPAResult } from './models.js';
import { runKpa } from './pipeline.js';
import type { Settings } from './settings.js';

export type { KPAResult, KeyPoint, Quote, Source } from './models.js';
export { printResult } from './display.js';

export interface PipelineOptions {
	strategy?: 'bottom-up' | 'top-down';
	numSources?: number;
	forceRefresh?: boolean;
	cache?: KPACache;
	settings?: Settings;
}

export async function pipeline(query: string, opts: PipelineOptions = {}): Promise<KPAResult> {
	return runKpa(query, opts.strategy ?? 'bottom-up', opts.numSources, opts.forceRefresh ?? false, {
		...(opts.cache !== undefined && { cache: opts.cache }),
		...(opts.settings !== undefined && { settings: opts.settings }),
	});
}
