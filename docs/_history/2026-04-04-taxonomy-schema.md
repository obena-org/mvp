---
title: "Introduce taxonomy-driven argument graph: Prisma schema + structured extraction"
date: 2026-04-04
status: complete
owner: Mike Albrecht
related-issues: []
related-prs: []
related-docs:
  - docs/op-ed-taxonomy.md
  - docs/taxonomy-query-strategy.md
  - docs/taxonomy-display-design.md
  - prisma/schema.prisma
tags: [taxonomy, schema, prisma, sqlite, extraction, argument-graph]
---

## 🧭 Context

`KPAResult` treats every extracted point as a `KeyPoint` — a thematic cluster with supporting quotes. This is useful
as a surface summary but discards most of the argumentative structure an op-ed actually contains. A point claiming
"airstrikes are illegal under international law" and a point claiming "Trump is acting impulsively" are both
represented identically: as a titled cluster with a quote list. They cannot be compared, linked, or sorted by kind.

The taxonomy document (`docs/op-ed-taxonomy.md`) defines the richer structure that op-ed commentary actually carries:
argument units with types (problem framing, diagnostic, normative, proposal, forecast, legal/procedural, actor
appraisal, …), positions (for / against / with conditions), links to issue nodes and proposal nodes, and typed
relation edges between claims. The current flat schema cannot represent any of this — it cannot answer "which sources
favor the ceasefire proposal?" or "what are the competing diagnostic claims about inflation?" or "who holds what
position on the bundle vs. individual components?"

## 🎯 Decision

Introduce a Prisma-managed SQLite database as the persistence and query layer, alongside (not replacing) the existing
disk cache and `KPAResult` API output. The schema (`prisma/schema.prisma`) is the single authoritative definition of
the taxonomy data model; documentation references it rather than restating it.

Key outcomes:

- Define `Issue`, `Question`, `DecisionObject`, `Proposal`, `ArgumentUnit`, `RelationEdge`, and `IssueRelation`
  as first-class Prisma models
- `ArgumentUnit` carries the full v1 operational taxonomy (9 argument types) with the 3 v2 types defined but
  deferrable; `ArgType`, `ClaimRole`, `Centrality`, `RelationType` are native Prisma enums
- `Proposal` has first-class `claimedEnds` / `proposedMeans` / `opposedMeans` / `altMeans` fields; supports
  self-referential bundle hierarchy
- `RelationEdge` connects any `ArgumentUnit`–`ArgumentUnit`, `ArgumentUnit`–`Proposal`, or
  `Proposal`–`Proposal` pair with a typed relation
- `SearchRun` anchors a query execution to its produced `ArgumentUnit[]` and `Issue[]`; `KPAResult` is kept
  as the public API output format for backward compatibility (pipeline returns both)
- Prisma client is generated from the schema; app code never writes raw SQL

### 🔄 Before / After

Before:

    pipeline → KPAResult { keyPoints: KeyPoint[] }
    KeyPoint: { title, summary, quotes[] }
    — no type, no stance, no issue linkage, no relations

After:

    pipeline → KPAResult (unchanged) + SearchRun persisted to DB
    SearchRun → ArgumentUnit[] (classified, positioned, issue-linked)
    Issue → Question[] → Proposal[] → ArgumentUnit[]
    ArgumentUnit → ArgumentUnit (via RelationEdge)

### 🧩 Mental Model

- `ArgumentUnit` is the atom. Everything else is structural scaffolding.
- `Issue` is not a topic tag; it is a controversy node that hosts competing positions and proposals.
- `Proposal` is not an article; it is a candidate action that multiple sources can support, oppose, or qualify.
- `RelationEdge` is what makes comparison possible — not co-mention, but typed reasoning links.
- The DB is a write-once-per-run analysis store, not a transactional application database.

### 🧾 Stable Terms

```
SearchRun      → One pipeline execution for a query (anchors all produced ArgumentUnits and Issues)
ArgumentUnit   → Atomic extracted claim: typed, positioned, issue-linked
ArgType        → The 12-type full ontology (v1: first 9); maps to taxonomy section A–L
ClaimRole      → Rhetorical role of the unit in its source (core thesis, supporting, rebuttal, …)
Centrality     → How central the claim is to its source piece (central / supporting / peripheral)
Issue          → Controversy or problem area (not a topic tag); can have parent / children / siblings
Proposal       → Candidate action; may be a bundle with component Proposals
DecisionObject → Concrete official artifact (bill, ballot measure, plan, docket, order, case)
RelationEdge   → Typed link between two ArgumentUnits or between ArgumentUnit and Proposal
```

## 🔍 Key Tradeoffs

**SQLite via Prisma — gained:** zero-config persistence, no server process, Prisma migrations for schema evolution,
full relational query capability. **Accepted:** JSON array fields (`claimedEnds`, etc.) stored as strings (SQLite
has no native array type); Prisma's `Json` type is available but parsed in app code.

**Prisma schema as the only model definition — gained:** single source of truth, avoids drift between TS types
and DB columns, self-documenting via comments. **Accepted:** generated Prisma client must be regenerated after
schema changes; docs link to `prisma/schema.prisma` rather than copy-pasting field lists.

**v1 operational set (9 types) + v2 defined but deferred — gained:** labels `TRADEOFF_BALANCING`,
`COALITION_STRATEGY`, and `META_DISCURSIVE` are present in the enum from day one (no migration needed to add
them); extraction prompts and UI can treat them as low-priority initially. **Accepted:** annotator/model drift
risk on the three v2 types is managed by deferring them from training examples, not from the schema.

**`KPAResult` kept as public API output — gained:** web SPA and CLI are unaffected; no breaking change to
consumers. **Accepted:** `KPAResult.keyPoints[]` is derived from `ArgumentUnit[]` after the DB write; the
derivation is lossy (collapses type/position metadata) but keeps the existing display layer working.

## 🔄 Migration Shape

Additive. The disk cache and `KPAResult` API contract are unchanged. The new DB is written as a side-effect of
pipeline execution; it is not required for existing callers. First runs initialize the DB (Prisma `db push` or
`migrate dev`). The schema adds a `DATABASE_URL` setting to `config/.env.secrets.example`.

## 📌 Enduring Constraints

- `ArgumentUnit.textSpan` must be a direct quote or minimal paraphrase — not a synthesized summary. Synthesis
  belongs in `claimSummary`. This separation is load-bearing for source attribution.
- `ArgType` assignments must follow the taxonomy flowchart decision tree; the `secondaryType` field exists
  for genuine dual-category claims (Rule 6) only — not for uncertain classification.
- `RelationEdge` must have exactly one non-null `fromUnitId`/`fromProposalId` and one non-null
  `toUnitId`/`toProposalId` — partial edges are invalid.
- `Issue.status` defaults to `ACTIVE`; do not auto-mark issues as `HISTORICAL` based on query age alone.

## 📈 Consequences

- The pipeline can now answer structured questions: which sources support which proposals, which argument types
  dominate a query, what the distribution of normative vs. diagnostic claims is.
- The SPA can render an argument map (issue tree + proposal cards + argument type breakdowns) rather than
  only a flat key-point list.
- `SearchRun` history replaces the current `query_history.json` flat file as the authoritative execution record.
- Future LLM extraction passes can be validated against the schema (Zod ↔ Prisma types stay in sync via
  `@zod/prisma`-style mapping or manual mirroring).

## 🔗 Where to Look Now

- Schema: `prisma/schema.prisma`
- Taxonomy spec: `docs/op-ed-taxonomy.md`
- Extraction strategy: `docs/taxonomy-query-strategy.md`
- Display design: `docs/taxonomy-display-design.md`

## 🗂️ One-Sentence Summary

"Introduced a Prisma/SQLite argument graph — Issue, Proposal, ArgumentUnit, RelationEdge — as the persistence
layer for the op-ed taxonomy, keeping KPAResult as the backward-compatible API output."
