/**
 * Prompt templates for KPA extraction passes.
 * Mirrors rnd-kpa/src/rnd_kpa/prompts.py exactly.
 *
 * Bump version strings when prompt content changes to invalidate cached extractions.
 */

import type { Source } from './models.js';

export const PASS1_BU_V = 'v1';
export const PASS2_BU_V = 'v1';
export const PASS1_TD_V = 'v1';
export const PASS2_TD_V = 'v1';

const _CONTENT_LIMIT = 6_000;

export function pass1BottomUp(source: Source): string {
	const metaParts = [
		source.title ? `Title: ${source.title}` : null,
		source.author ? `Author: ${source.author}` : null,
		source.outlet ? `Outlet: ${source.outlet}` : null,
		`URL: ${source.url}`,
	].filter(Boolean);
	const meta = metaParts.join('\n');

	return `You are analyzing a news article or op-ed.

${meta}

Article:
${source.content.slice(0, _CONTENT_LIMIT)}

Extract up to 5 distinct claims or positions argued in this article. For each, \
provide a direct quote (1-3 verbatim or near-verbatim sentences from the text) that \
best supports it.

Focus on substantive arguments, not news summaries. If the article contains no usable \
opinion content, return an empty quotes list.`;
}

export function pass2BottomUp(query: string, candidatesJson: string): string {
	return `You are synthesizing perspectives from multiple op-ed articles about \
"${query}".

Below are claims and supporting quotes extracted from various sources:

${candidatesJson}

Group these into 3-7 coherent key points representing distinct perspectives in the \
discourse.

Requirements for each key point:
- title: a stated position or claim (e.g. "Western sanctions are counterproductive"), \
NOT a neutral topic heading (e.g. "Sanctions")
- summary: 2-3 sentences synthesizing the perspective across sources
- quotes: 2-4 entries from distinct source URLs; preserve exact quote text; \
set author/outlet to null if unknown`;
}

export function pass1TopDown(query: string, articlesSummary: string): string {
	return `You are reading summaries of multiple op-ed articles about "${query}".

${articlesSummary}

Identify 3-7 distinct key points (named claims or perspectives) that appear across \
these articles.

Each key point title must state a position (e.g. "Diplomatic engagement is the only \
viable path"), not a neutral topic category. Cover the range of perspectives \
present, including minority views.`;
}

export function pass2TopDown(
	query: string,
	keyPointsJson: string,
	articlesContent: string,
): string {
	return `You are finding supporting quotes for key points about "${query}".

Key points to support:
${keyPointsJson}

Articles:
${articlesContent}

For each key point provide:
- summary: 2-3 sentences synthesizing the perspective
- quotes: 2-4 direct quotes (1-3 verbatim sentences) from the articles above

Requirements: preserve exact quote text; only use quotes from the provided articles; \
set author/outlet to null if not determinable from the article.`;
}
