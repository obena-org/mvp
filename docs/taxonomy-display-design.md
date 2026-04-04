# Taxonomy Display Design

**What this doc covers:** how to render the argument graph on the CLI and SPA — layout, interaction model,
and the mapping from DB models to UI components.

**Schema reference:** `prisma/schema.prisma`
**Query strategy:** `docs/taxonomy-query-strategy.md`
**Taxonomy spec:** `docs/op-ed-taxonomy.md`

---

## Design principle

The taxonomy produces two conceptually different views of the same data:

1. **Issue-centric** (the default) — organized around the controversy graph: root issue → sub-issues →
   proposals (with stance distribution) → argument units by type.
2. **Type-centric** (secondary) — organized around the 12 argument types: all `NORMATIVE_EVALUATIVE`
   claims across sources, or all `ACTOR_APPRAISAL` claims.

Both views use the same underlying DB query; they are presentation choices, not separate data pipelines.
The v1 release ships the issue-centric view only.

---

## CLI display (`src/display.ts` evolution)

### v1 layout

The existing `printResult()` renders `KPAResult.keyPoints[]`. In the taxonomy build, it continues to work
as-is via the KPAResult derivation (see query strategy §KPAResult derivation). A parallel `printArgGraph()`
function renders the richer structure when the `--taxonomy` flag is set.

```
╔══════════════════════════════════════════════════╗
║  Query: U.S.-Iran war                            ║
║  Sources: 18  ·  2026-04-04  ·  bottom-up        ║
╚══════════════════════════════════════════════════╝

◉ ROOT ISSUE: U.S. policy toward the Iran war
  ├─ SUB-ISSUE: Legality of U.S. actions
  ├─ SUB-ISSUE: Presidential competence/judgment
  └─ SUB-ISSUE: Regional and economic consequences

  PROPOSALS
  ─────────
  ► Seek negotiated ceasefire          [8 for · 3 against · 2 with-conditions]
  ► Continue current air campaign      [5 for · 6 against]
  ► Escalate strikes                   [2 for · 9 against]

  ARGUMENT BREAKDOWN  (18 units total)
  ───────────────────
  Problem framing          ████░░  4
  Diagnostic / causal      ███░░░  3
  Normative / evaluative   █████░  5
  Proposal                 ████░░  4
  Consequence / forecast   ██░░░░  2

  TOP QUOTES (by centrality)
  ──────────────────────────
  [normative] "A preventive war is morally indefensible."
      — Jane Smith · The Atlantic

  [proposal] "The U.S. should seek an off-ramp before regional spillover becomes irreversible."
      — John Doe · Foreign Policy

  [legal] "The president lacks authority to continue hostilities without congressional authorization."
      — Mary Jones · The New York Times
```

### CLI flags

| Flag | Effect |
|------|--------|
| `--output pretty` | existing KeyPoint view (default, backward compat) |
| `--output taxonomy` | new argument graph view (`printArgGraph`) |
| `--output json` | full DB-shaped JSON (includes `ArgumentUnit[]`, `Issue[]`, `Proposal[]`) |
| `--type <argtype>` | filter to one ArgType in taxonomy view |

### `printArgGraph()` implementation notes

- `src/display.ts` gains `printArgGraph(run: SearchRunWithGraph, writeFunc)` alongside existing `printResult()`.
- `SearchRunWithGraph` is a Prisma query result: `SearchRun` + `include: { issues, argumentUnits, proposals }`.
- The bar chart uses `█` / `░` characters; width = 6 chars max, scaled to the highest count.
- Proposal stance distribution: count `ArgumentUnit[]` by `position` value per `proposalId`.
- Top quotes: sort by `centrality` (CENTRAL first) then `argType` (prefer non-PROPOSAL types for diversity).
- Color scheme (chalk): root issue title = bold white; sub-issues = dim; proposals = cyan; type labels = yellow;
  quote text = white; attribution = dim.

---

## SPA display (`web/src/routes/+page.svelte` evolution)

### Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Query input bar]                             [Strategy picker] [Run]   │
├──────────────────┬───────────────────────────────────────────────────────┤
│                  │                                                        │
│  Issue sidebar   │  Main panel (switches between views)                  │
│  ─────────────   │  ─────────────────────────────────────────────────    │
│  ◉ Root issue    │  [View tabs: Key Points | Argument Map | Proposals]   │
│    ├ Sub-issue   │                                                        │
│    ├ Sub-issue   │  [content area]                                        │
│    └ Sub-issue   │                                                        │
│                  │                                                        │
│  [History]       │                                                        │
└──────────────────┴───────────────────────────────────────────────────────┘
```

### Tab: Key Points (v1 default, existing behavior)

The current card-based key-points view, unchanged. Rendered from `KPAResult.keyPoints[]`. This is the
default tab until the argument map is stable.

### Tab: Argument Map (v1 MVP)

An issue-centric panel. No force-directed graph in v1 — too complex for initial implementation. Use a
structured card layout instead:

```
[Root Issue card]
  ┌────────────────────────────────────────────────────────────┐
  │ U.S. policy toward the Iran war                            │
  │ Foreign policy · United States · Active                    │
  │                                                            │
  │ Argument units: 18   Sources: 12                           │
  │                                                            │
  │ [FRAMING 4]  [DIAGNOSTIC 3]  [NORMATIVE 5]                 │
  │ [PROPOSAL 4]  [FORECAST 2]                                 │
  └────────────────────────────────────────────────────────────┘

  [Sub-issue cards — collapsed by default, expand on click]

  Sub-issue: Legality of U.S. actions
  ┌────────────────────────────────────────────────────────────┐
  │ 3 argument units  ·  LEGAL/PROCEDURAL                      │
  │ ▸ "The president lacks authority…" — NYT                   │
  │ ▸ "Attacks on civilian infrastructure may violate…" — WaPo │
  └────────────────────────────────────────────────────────────┘
```

Each argument unit card shows:

- `argType` badge (colored by type)
- `claimSummary`
- `textSpan` (collapsible quote, similar to existing quote card)
- Attribution: author · outlet · [link to source]
- `centrality` indicator (bold border = CENTRAL)
- `position` badge if set (green = for, red = against, yellow = with-conditions)

### Synthesis transparency inspector (v1, behind toggle)

Users will eventually ask: why was this claim attached to this issue? Why were these proposals merged? The
`issueHint`, `proposalHint`, and `linkConfidence` fields on `ArgumentUnit` are persisted specifically to
answer this. Surface them behind a "debug" or "show reasoning" toggle on each unit card:

```
▾ [show synthesis details]
  Pass 1 issue hint:    "U.S.-Iran war"
  Pass 2 canonical:     "U.S. policy toward the Iran war"  ← Issue.title
  Issue link confidence: MEDIUM

  Pass 1 proposal hint: "ceasefire"
  Pass 2 canonical:     "Seek negotiated ceasefire"        ← Proposal.title
  Proposal link confidence: HIGH
```

This makes calibration practical: when the extraction distorts debates in recurring ways, you can see
exactly where the synthesis diverged from the raw hint. Keep the toggle off by default; expose via
`?debug=1` query param or a settings panel in v1.

### Tab: Proposals (v1 MVP)

A comparison table across proposals:

```
┌────────────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Proposal               │ For              │ Against          │ With conditions  │
├────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Seek ceasefire         │ ████████ 8       │ ███ 3            │ ██ 2             │
│ Continue air campaign  │ █████ 5          │ ██████ 6         │ —                │
│ Escalate strikes       │ ██ 2             │ █████████ 9      │ —                │
└────────────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

Clicking a row expands to show the argument units for that proposal, grouped by position.

For **bundle proposals**, add a component accordion:

```
► Approve BMT Vision Plan (bundle)
  Components:
  ├─ Maritime modernization    [4 for · 1 against]
  ├─ Housing component         [2 for · 3 against]
  ├─ Resiliency infrastructure [5 for · 0 against]
  └─ Governance structure      [3 for · 2 with-conditions]
```

### Issue sidebar

The issue sidebar replaces the existing history sidebar in taxonomy mode. It shows:

- Root issue(s) for the current `SearchRun`
- Sub-issues as indented items
- Click to filter the main panel to that issue's argument units
- Linked issues (legality, actor, process, consequence) shown with relation type label

The history accordion from the existing sidebar moves to a history icon / dropdown.

---

## API shape for the SPA

The existing SSE stream (`GET /api/kpa/stream`) emits `complete: KPAResult`. In the taxonomy build, extend
this with an optional `argGraph` field on the complete event:

```typescript
// web/src/lib/models.ts addition
interface ArgGraphSummary {
  issues: IssueSummary[];          // id, title, parentId, domain, status
  proposals: ProposalSummary[];    // id, title, isBundle, parentId, status
  argumentUnits: ArgUnitSummary[]; // id, argType, claimSummary, centrality, position,
                                   //   issueId, proposalId, author, outlet, sourceUrl
}

// ProgressEvent 'complete' event gains:
| { type: 'complete'; result: KPAResult; argGraph?: ArgGraphSummary }
```

`argGraph` is optional; existing clients that ignore it remain unaffected. The SPA checks for it and renders
the argument map tabs when present.

A separate endpoint (`GET /api/kpa/run/:id`) returns the full `SearchRun` with relations for deep queries
(used when a user clicks into a specific run from history).

---

## Argument type color palette

Consistent across CLI (chalk) and SPA (Tailwind / CSS custom properties):

| ArgType | Color | Rationale |
|---------|-------|-----------|
| `PROBLEM_FRAMING` | Violet | Definitional / framing |
| `DIAGNOSTIC_CAUSAL` | Amber | Causal attribution |
| `NORMATIVE_EVALUATIVE` | Rose | Value judgment |
| `PROPOSAL_PRESCRIPTION` | Sky blue | Action / forward-looking |
| `IMPLEMENTATION_DESIGN` | Teal | Design / detail |
| `CONSEQUENCE_FORECAST` | Orange | Effect / outcome |
| `FACTUAL_PREMISE_DISPUTE` | Stone/gray | Empirical dispute |
| `LEGAL_PROCEDURAL` | Indigo | Authority / process |
| `ACTOR_APPRAISAL` | Purple | Person / institution |
| `TRADEOFF_BALANCING` | Lime | Competing goods |
| `COALITION_STRATEGY` | Cyan | Political / strategic |
| `META_DISCURSIVE` | Zinc | About the debate |

Use the same Tailwind OBENA accent (royal purple) for primary UI chrome; argument type colors are semantic
overlays, not branding.

---

## Progressive enhancement path

| Phase | CLI | SPA |
|-------|-----|-----|
| v1 | `--output taxonomy` flag; `printArgGraph()` | Argument Map tab + Proposals tab (card layout) |
| v2 | `--type <argtype>` filter | Force-directed argument graph (D3 or Svelte-vis) |
| v3 | Diff view (compare two runs) | Cross-run comparison; relation edge visualization |
