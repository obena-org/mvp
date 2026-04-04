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
export const TAX_PASS1_V = 'v1';
export const TAX_PASS2_V = 'v1';

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

export function pass1Taxonomy(source: Source, query: string): string {
	const metaParts = [
		source.title ? `Title: ${source.title}` : null,
		source.author ? `Author: ${source.author}` : null,
		source.outlet ? `Outlet: ${source.outlet}` : null,
		`URL: ${source.url}`,
	].filter(Boolean);
	const meta = metaParts.join('\n');

	return `You are extracting structured argument units from an op-ed or news commentary.

We are analyzing commentary about: "${query}".

${meta}

Article:
${source.content.slice(0, 6_000)}

Extract all substantive argumentative claims. Aim for 4–10 units per article. \
Prioritize CENTRAL units; include SUPPORTING ones that add meaningful depth. \
If the article contains no usable argument content, return an empty units array.

Classify each unit by argument type using this decision order:
1. Mainly says what should be done → PROPOSAL_PRESCRIPTION
2. Mainly judges a person or institution → ACTOR_APPRAISAL
3. Mainly about legality / authority / process → LEGAL_PROCEDURAL
4. Mainly predicts effects or consequences → CONSEQUENCE_FORECAST
5. Mainly defines what the problem really is → PROBLEM_FRAMING
6. Mainly assigns causes or blame → DIAGNOSTIC_CAUSAL
7. Mainly a moral / fairness / legitimacy judgment → NORMATIVE_EVALUATIVE
8. Mainly accepts a proposal but argues over how to design/implement it → IMPLEMENTATION_DESIGN
9. Disputes underlying facts → FACTUAL_PREMISE_DISPUTE

Disambiguation:
- PROBLEM_FRAMING defines scope/scale/who is affected. "The real fight is deterrence, not regime change."
- NORMATIVE_EVALUATIVE says something is good/bad/just/reckless. "Preventive war is morally indefensible."
- If a claim does two jobs (reframes AND judges), use the primary type and set secondaryType.

Position values by argType:
- PROPOSAL_PRESCRIPTION / IMPLEMENTATION_DESIGN: for | against | for-with-conditions | \
for-in-principle-against-current | prefer-alternative | unclear | mixed
- ACTOR_APPRAISAL: positive | negative | mixed | comparative
- FACTUAL_PREMISE_DISPUTE: affirms-premise | denies-premise | reframes-premise | uncertainty-too-high
- NORMATIVE_EVALUATIVE: just | unjust | prudent | imprudent | legitimate | illegitimate

Evidence styles: moral | empirical | legal | historical-analogy | expert-authority | procedural | strategic`;
}

export function pass2Taxonomy(query: string, compressedUnitsJson: string): string {
	return `You are synthesizing argument units extracted from op-ed sources about "${query}".

Below are compressed structural hints from all extracted units (indexed 0-based):

${compressedUnitsJson}

Your task:
1. Identify canonical Issue nodes (distinct controversy areas with hierarchy).
2. Identify canonical Proposal nodes (distinct candidate actions with bundle structure).
3. Assign each unit (by index) to its canonical issue and/or proposal.

Issue organization rules:
- MERGE when op-eds treat two framings as the same decision.
- PARENT-CHILD: when one is a broader problem and the other is a specific lever.
- SIBLING: alternative responses to the same root problem.
- SPLIT: when op-eds disagree on different objects (policy vs. legality vs. actor fitness).
- For linked side-issues, use linkedIssues with relationType: \
SIBLING | LINKED_LEGALITY | LINKED_ACTOR | LINKED_PROCESS | LINKED_CONSEQUENCE | CLUSTER.

Proposal rules:
- Bias toward MORE proposals + MORE linking rather than aggressive merging.
- "Ceasefire", "off-ramp", and "pause escalation" should usually remain distinct unless \
the sources explicitly treat them identically.
- Set isBundle=true when a plan has separable components.
- For bundles, create component proposals with parentTempId pointing to the bundle.

For each unit linkage, set issueLinkConfidence:
- HIGH: issue is explicit in the source text
- MEDIUM: likely correct, one clear candidate
- LOW: plausible but uncertain, multiple candidates`;
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
