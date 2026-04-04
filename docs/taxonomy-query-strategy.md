# Taxonomy Query Strategy

**What this doc covers:** how to drive Claude to populate the Prisma argument graph from fetched sources,
including prompt structure, pass architecture, and how the taxonomy flowchart maps to extraction logic.

**Schema reference:** `prisma/schema.prisma`
**Taxonomy spec:** `docs/op-ed-taxonomy.md`
**Display design:** `docs/taxonomy-display-design.md`

---

## Overview

The existing pipeline has two extraction strategies (bottom-up, top-down), each with two Claude passes, producing
a flat `KeyPoint[]`. The taxonomy pipeline extends this to three passes, producing a structured argument graph
(`ArgumentUnit[]` linked to `Issue` and `Proposal` nodes) that is persisted to SQLite via Prisma.

The `KPAResult` API shape is unchanged — it is derived from the argument graph after the DB write.

---

## Pass architecture

```
Sources (Firecrawl)
    │
    ▼
Pass 1 — Per-source argument extraction   (parallel, one Claude call per source)
    │     → RawArgumentUnit[] per source (classified, with textSpan + claimSummary)
    │
    ▼
Pass 2 — Issue / proposal synthesis       (single call over all Pass 1 output)
    │     → canonical Issue[], Proposal[], Question[] with ArgumentUnit linkage
    │
    ▼
Pass 3 — Relation edge synthesis          (single call, v2; defer in v1)
    │     → RelationEdge[] between ArgumentUnits and Proposals
    │
    ▼
DB write (Prisma)
    │
    ▼
KPAResult derivation (backward-compat output)
```

---

## Pass 1 — Per-source argument extraction

### Goal

Extract all substantive argumentative claims from one source article, classify each by the taxonomy, and
record the textSpan (direct quote / minimal paraphrase), claimSummary, argType, claimRole, centrality,
position, evidenceStyle, and optional tagging dimensions.

### What to classify

An **argument unit** is an atomic claim — a single idea that can stand on its own as a point in a debate.
One sentence in an op-ed may contain one unit; one paragraph may contain two or three. Aim for roughly 4–10
units per article; do not extract peripheral filler. Use `centrality` to weight, not to filter.

### Flowchart → prompt encoding

The taxonomy flowchart (§Decision tree) is a sequential decision procedure:

1. Is the point mainly saying **what should be done**? → `PROPOSAL_PRESCRIPTION`
   - Then: single proposal or bundle? If bundle, flag `isBundle`.
2. Is it mainly **judging a person or institution**? → `ACTOR_APPRAISAL`
3. Is it mainly about **legality, authority, or process**? → `LEGAL_PROCEDURAL`
4. Is it mainly **predicting effects or consequences**? → `CONSEQUENCE_FORECAST`
5. Is it mainly **defining the problem or assigning causes**?
   - Problem definition → `PROBLEM_FRAMING`
   - Cause / blame → `DIAGNOSTIC_CAUSAL`
6. Is it mainly about **values or tradeoffs**?
   - Values → `NORMATIVE_EVALUATIVE`
   - Tradeoffs → `TRADEOFF_BALANCING` _(v2)_
   - Fact dispute → `FACTUAL_PREMISE_DISPUTE`
   - Debate quality → `META_DISCURSIVE` _(v2)_

Encode this in the prompt as a **short decision guide**, not the full flowchart. The classification section
of the prompt should look like:

```
Classify each unit by argument type using this decision order:
1. Mainly says what should be done → PROPOSAL_PRESCRIPTION
2. Mainly judges a person or institution → ACTOR_APPRAISAL
3. Mainly about legality / authority / process → LEGAL_PROCEDURAL
4. Mainly predicts effects or consequences → CONSEQUENCE_FORECAST
5. Mainly defines what the problem really is → PROBLEM_FRAMING
6. Mainly assigns causes or blame → DIAGNOSTIC_CAUSAL
7. Mainly a moral / fairness / legitimacy judgment → NORMATIVE_EVALUATIVE
8. Disputes underlying facts → FACTUAL_PREMISE_DISPUTE
[v2 only:] 9. Two goods cannot all be maximized → TRADEOFF_BALANCING
[v2 only:] 10. Comments on how the debate is being conducted → META_DISCURSIVE
```

### Disambiguation notes to include in Pass 1 prompt

Pull from taxonomy §Disambiguation: problem framing vs normative vs meta-discursive:

- **PROBLEM_FRAMING**: defines what the issue fundamentally is (scope, scale, who is affected).
  Example: "The real fight is deterrence, not regime change."
- **NORMATIVE_EVALUATIVE**: says something is good / bad / just / reckless.
  Example: "Preventive war is morally indefensible."
- **META_DISCURSIVE** _(v2)_: comments on how the debate is being framed or distorted.
  Example: "Pundits are conflating X with Y."
- If a sentence does both (reframes AND judges), assign a primary type and set `secondaryType`.

### Tool schema (Pass 1)

Use Claude's `tool_use` (JSON Schema via Zod → `_zodToJsonSchema()`).

```typescript
// src/extraction/taxonomy-pass1.ts (illustrative schema — implement with Zod)

const RawArgUnit = z.object({
  textSpan:     z.string(),           // direct quote or minimal close paraphrase
  claimSummary: z.string(),           // one-sentence normalized summary
  argType:      z.enum([ArgTypeValues]),
  secondaryType: z.enum([ArgTypeValues]).optional(),
  claimRole:    z.enum(['CORE_THESIS','SUPPORTING_REASON','REBUTTAL',
                        'CONCESSION','ANALOGY','ILLUSTRATIVE_EXAMPLE']),
  centrality:   z.enum(['CENTRAL','SUPPORTING','PERIPHERAL']),
  position:     z.string().optional(),     // for|against|for-with-conditions|…
  evidenceStyle: z.string().optional(),    // moral|empirical|legal|historical-analogy|…
  factualUncertainty: z.enum(['low','medium','high']).optional(),
  interpretivelyAmbiguous: z.boolean().default(false),
  targetActorName: z.string().optional(), // for ACTOR_APPRAISAL only
  targetActorType: z.enum(['person','institution']).optional(),
  // rough placement hints (synthesis pass resolves canonical nodes)
  issueHint:    z.string().optional(),    // brief label, e.g. "U.S.-Iran war"
  proposalHint: z.string().optional(),    // brief label, e.g. "seek ceasefire"
  // tagging dimensions (best-effort in pass 1)
  domain:       z.string().optional(),
  geoScope:     z.enum(['local','national','regional','global']).optional(),
  timeHorizon:  z.string().optional(),
});

const Pass1Result = z.object({
  sourceUrl:  z.string(),
  units:      z.array(RawArgUnit),
});
```

### Cache key

```
claude:tax:p1:<PASS1_V>:<hash(sourceContent + query)>
```

Version `PASS1_V` when the prompt or schema changes — same pattern as existing bottom-up/top-down versioning.

---

## Cross-run issue identity

**Treat each `SearchRun`'s issue graph as locally canonical.** Do not attempt to merge issue nodes across
runs in Pass 2. Issue identity is hard to stabilize across different source mixes: "Legality of U.S.
actions," "Congressional authorization," and "constitutional war powers" may be the same issue in one run
and usefully distinct in another.

Global canonicalization — matching issue nodes across runs to a shared canonical set — is a separate future
layer, not part of the extraction pipeline. For now, two runs on the same query may produce slightly
different issue graphs; that is acceptable and expected.

---

## Pass 2 — Issue / proposal synthesis

### Goal

Across all Pass 1 `RawArgUnit[]` from all sources, identify:

1. **Canonical Issue nodes** — deduplicate issue hints into real controversy nodes with parent/child/sibling
   structure (root issue + sub-issues). Apply merge / link / split rules from taxonomy §4.
2. **Canonical Proposal nodes** — deduplicate proposal hints into actionable candidate actions, resolve
   bundle structure. Assign `ProposalStatus` where evident.
3. **Question nodes** — identify the specific debatable prompts that units are answering.
4. **Link assignments** — for each `RawArgUnit`, assign its canonical `issueId`, `proposalId`,
   `questionId` (by label cross-reference, not re-classification).
5. **Actor nodes** — extract distinct actors mentioned in `targetActorName` fields.

### Merge / link / split rules (from taxonomy §Issue organization)

Include a condensed version of these rules in the Pass 2 prompt:

- **Merge** when op-eds treat two framings as the same decision (same decision-maker, same proposal set).
- **Parent–child**: when one is a broader problem and the other is a specific lever (e.g. "inflation" →
  "Fed rate policy").
- **Sibling**: when two proposals are alternative responses to the same root problem.
- **Split**: when op-eds disagree on different objects (policy substance vs. legality vs. actor fitness).
- **Cluster** recurring sub-issue complexes (war aims, legality, civilian harm, exit strategy).

### Ends and means extraction (for Proposal nodes)

For each proposal, extract:

- `claimedEnds`: what goals the advocates say it serves (security, affordability, deterrence, …)
- `proposedMeans`: the specific instrument (airstrikes, rate cut, rezoning, …)
- `opposedMeans`: any instrument the author rejects while keeping the end
- `altMeans`: any substituted path the author prefers

This distinction (taxonomy Rule 4) is what lets the system identify shared-end / different-means disagreements.

### Bundle detection

Flag `isBundle = true` when:

- advocates present the plan as a package,
- components can be separately supported or criticized (e.g. BMT Vision Plan: maritime + housing + resiliency),
- tradeoffs within the package matter.

Create component Proposal nodes linked via `parentId`.

### Tool schema (Pass 2)

```typescript
// Illustrative — implement with Zod
const SynthesisResult = z.object({
  issues: z.array(z.object({
    tempId:      z.string(),  // local ID for cross-reference in this response
    title:       z.string(),
    description: z.string().optional(),
    domain:      z.string().optional(),
    geography:   z.string().optional(),
    timeHorizon: z.string().optional(),
    arena:       z.string().optional(),
    parentTempId: z.string().optional(),  // for sub-issue parent–child
    relatedIssues: z.array(z.object({
      tempId:      z.string(),
      relationType: z.string(), // sibling|linked-legality|linked-actor|linked-process|linked-consequence
    })).optional(),
  })),
  proposals: z.array(z.object({
    tempId:      z.string(),
    title:       z.string(),
    actionVerb:  z.string().optional(),
    actorName:   z.string().optional(),
    isBundle:    z.boolean().default(false),
    parentTempId: z.string().optional(),
    status:      z.string().optional(),  // ProposalStatus value
    claimedEnds: z.string().optional(),  // pipe-separated
    proposedMeans: z.string().optional(),
    opposedMeans:  z.string().optional(),
    altMeans:      z.string().optional(),
    issueTempId:  z.string().optional(),
  })),
  unitLinkages: z.array(z.object({
    unitIndex:    z.number().int(),   // index into the flat input array
    issueTempId:  z.string().optional(),
    proposalTempId: z.string().optional(),
    questionText: z.string().optional(),  // the specific debatable prompt this unit answers
    position:     z.string().optional(),  // refined position (if pass-1 was unclear)
  })),
});
```

### Cache key

```
claude:tax:p2:<PASS2_V>:<hash(query + JSON(allPass1Units))>
```

---

## Pass 3 — Relation edge synthesis (v2, defer in v1)

### Goal

Given all `ArgumentUnit`s and `Proposal`s from the DB (post-write), identify typed `RelationEdge`s between
them. Start with the v1 core set: `SUPPORTS`, `OPPOSES`, `QUALIFIES`, `REBUTS`, `CONCEDES`,
`ALTERNATIVE_TO`, `DEPENDS_ON_FACTUAL_PREMISE`, `ANSWERS_QUESTION`.

### Approach

- Run after Pass 2 DB write, over the full set of units for the current `SearchRun`.
- Limit to units within the same issue cluster (cross-issue relations are rare and noisy).
- Produce at most one edge per ordered pair (from, to); skip if no clear relation exists.
- Do not require symmetric edges — `supports` and `opposes` are directed.

### Cache key

```
claude:tax:p3:<PASS3_V>:<hash(searchRunId + JSON(unitIds))>
```

---

## KPAResult derivation (backward compat)

After the DB write, derive `KPAResult.keyPoints[]` from `ArgumentUnit`s grouped by `issueId`:

- One `KeyPoint` per root `Issue` (or top-level issue cluster if no root exists).
- `KeyPoint.title` ← `Issue.title`
- `KeyPoint.summary` ← synthesized from `CORE_THESIS` or `CENTRAL` argument units for that issue
- `KeyPoint.quotes[]` ← `textSpan` values from `CENTRAL` + `SUPPORTING` units, up to the existing cap

This derivation is lossy (collapses type/position) but keeps the web SPA and CLI display layer working
without changes in v1.

---

## Prompt engineering notes

- **Anchor the query in the system prompt:** "We are analyzing commentary about: {query}." This prevents
  the model from drifting to adjacent topics when classifying ambiguous claims.
- **Give 1–2 examples per ArgType** in the Pass 1 system prompt — pulled from the taxonomy examples section.
  Do not give more than 2 per type; prompt length grows fast across 12 types.
- **Pass 2 context window:** all Pass 1 units concatenated can be large. Compress: send `claimSummary` +
  `argType` + `issueHint` + `proposalHint` only (not the full `textSpan`) to Pass 2. Pass 2 does not
  need the text; it needs the structural hints.
- **Token budget:** estimate ~300 tokens per source for Pass 1 output; 20 sources → ~6 000 tokens for
  Pass 2 input. Well within `claude-sonnet-4-6` context limits.

---

## Versioning

Each pass uses an independent version constant (like existing `PASS1_BU_V`, etc.):

```typescript
// src/extraction/taxonomy-versions.ts
export const TAX_PASS1_V = 'v1';
export const TAX_PASS2_V = 'v1';
export const TAX_PASS3_V = 'v1';
```

Bump only the affected pass version when its prompt or schema changes. Other passes retain their cache entries.

---

## v1 vs v2 feature boundary

| Feature | v1 (initial) | v2 (after calibration) |
|---------|-------------|----------------------|
| ArgTypes used in prompts | 9 (A–C, D–F, H–J) | + G, K, L |
| RelationEdges (Pass 3) | skipped | enabled |
| `secondaryType` | defined, not extracted | extracted in Pass 1 |
| Bundle coupling objections | noted in summary | modeled as `COMPONENT_OF` + separate stance |
| Actor nodes (separate model) | `targetActorName` string only | full Actor model |
