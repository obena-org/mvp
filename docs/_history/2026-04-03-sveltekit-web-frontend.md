---
title: "Add SvelteKit SPA + HTTP API adapter for KPA pipeline"
date: 2026-04-03
status: complete
owner: Mike Albrecht
related-issues: []
related-prs: []
related-docs:
  - docs/_history/2026-04-03-sveltekit-web-frontend.md
tags: [frontend, sveltekit, api, web-ui]
---

## 🧭 Context

The KPA pipeline produces rich structured output (`KPAResult`) containing key points, attributed quotes, source titles, authors, outlets, and URLs — but the only consumer is a terminal renderer that discards hyperlinks, cannot be shared, and is unreadable outside a capable terminal. Users had no way to browse results in a context where clickable article links, formatted quotes, and visual hierarchy matter.

The CLI and its `display.ts` rendering were purpose-built for operator use; they were never designed for end-user presentation. The gap between the richness of `KPAResult` and the poverty of ANSI text became the primary pressure for this change.

## 🎯 Decision

We added a SvelteKit SPA (`web/`) alongside the existing CLI. A thin HTTP API server wraps `pipeline()` and returns `KPAResult` as JSON; the SPA fetches that and renders a rich browser view. The existing CLI, pipeline, and cache layer are untouched.

- Introduce a `web/` SvelteKit app as a sibling package in the repo
- Introduce a lightweight HTTP API server (`src/server.ts`) that exposes `POST /api/kpa` and serves the SPA in production
- The SPA renders `KPAResult` with: clickable article links, card-based key points, inline quote attribution, cache/freshness badge, and strategy + source-count metadata
- No new database or persistence layer — the existing disk cache (`src/cache.ts`) is reused transparently
- `KPAResult` Zod schema (`src/models.ts`) becomes the shared contract between server and client

### 🔄 Before / After

Before:
    CLI → `pipeline()` → `display.ts` → ANSI terminal output (no links, no sharing)

After:
    CLI → `pipeline()` → `display.ts` → ANSI terminal (unchanged)
    Browser → HTTP API → `pipeline()` → JSON → SvelteKit renderer → rich hyperlinked UI

```text
Browser (SvelteKit SPA)
        ↓  fetch POST /api/kpa
   src/server.ts  (HTTP API adapter)
        ↓  await pipeline()
     src/pipeline.ts  (unchanged orchestrator)
        ↓
     src/cache.ts  (disk cache, reused)
```

### 🧩 Mental Model

This is a ports-and-adapters (hexagonal) structure:

- `pipeline()` is the core domain — it owns orchestration, never touched
- Adapters over the same output port:
  - CLI path: `pipeline()` → `display.ts` → terminal
  - Web path: `pipeline()` → `src/server.ts` → SvelteKit → browser
- The SvelteKit app is a consumer of `KPAResult`, not a new data model
- Not a rewrite; a new adapter alongside an existing one

### 🧾 Stable Terms

`src/server.ts` → HTTP API adapter; wraps `pipeline()`, serves SPA static assets in production  
`KPAResult` → unchanged shared contract between server JSON response and SvelteKit component props  
adapter → any presentation-layer consumer of `pipeline()` output (CLI renderer, HTTP server, future integrations)

## 🔍 Key Tradeoffs

- **SvelteKit over plain React/Vite:** SvelteKit gives us file-based routing, TypeScript-native DX, and SSR capability for future server-rendered result pages — at no extra complexity for the SPA-only initial case.
- **Fully async throughout:** All server handlers (`src/server.ts`) and SvelteKit load functions use `async`/`await`. The Node.js event loop is never blocked — `pipeline()` is awaited asynchronously within each request handler. From the HTTP client's perspective the response waits for pipeline completion (no job queue or polling); this keeps the system simple while preserving non-blocking I/O. A future evolution would introduce streaming or async job submission for better perceived latency.
- **Single request-response, no job queue (intentional constraint):** The API blocks the HTTP connection until `pipeline()` resolves. This eliminates job orchestration complexity but introduces multi-second latency per request, limits concurrent throughput, and requires the client to handle long load states and timeouts gracefully. This is the most likely constraint to revisit as usage scales.
- **Shared cache, not a database:** Reusing `src/cache.ts` means the web UI benefits from the same TTL-based caching as the CLI at zero infrastructure cost. The tradeoff is that cache is local to the server process; multi-instance deployment would require a shared cache backend.
- **No separate type package:** The SvelteKit client imports `KPAResult` types directly from `src/models.ts` via the server package's source tree — no type-only package is extracted. This avoids a third package but couples the `web/` build graph to the pipeline source. If this causes bundling issues (e.g., Zod runtime leaking into the client bundle), extract a `packages/types` workspace package.

## 🌐 API Contract

### POST /api/kpa

Request:

```json
{ "topic": "string", "options": { "strategy": "bottom-up | top-down", "numSources": "number (optional)", "forceRefresh": "boolean (optional)" } }
```

Response (200): `KPAResult` JSON (see `src/models.ts`)

Errors:

- `400` — missing or invalid `topic`
- `500` — pipeline failure

Notes:

- All handlers are `async`; the server never blocks the Node.js event loop
- The connection remains open until `pipeline()` resolves (~5–30 s depending on cache hit and source count)
- The `cacheHit` field in `KPAResult` indicates whether the response was served from disk cache

## 🚀 Deployment Assumptions

- Single-node deployment; no horizontal scaling assumed
- Cache is local disk (`src/cache.ts`); not shared across processes
- No container orchestration, reverse proxy, or CDN assumed in initial deployment
- Future: replace `src/cache.ts` with a shared backend (Redis, S3) to enable multi-instance deployment

## 🔄 Migration Shape

Clean addition — no existing behavior changes. The CLI continues to work exactly as before. The HTTP server is a new entry point (`src/server.ts`), not a replacement for `src/cli.ts`. A new `pnpm dev:web` script runs SvelteKit's dev server proxying the API; `pnpm start` runs the production server.

## 📌 Enduring Constraints

- `pipeline()` must remain the sole orchestrator; the HTTP handler must not duplicate extraction logic
- `KPAResult` is the API contract — any schema change must remain backward-compatible or version the endpoint
- The disk cache assumes a single server process; horizontal scaling requires replacing `src/cache.ts` with a shared store
- `console.*` remains restricted to `display.ts`, `logger.ts`, `cli.ts`, and the new `server.ts` bootstrap; the SvelteKit app uses no direct `console.*` calls

## 📈 Consequences

- URLs encode the query topic; results are recomputed on load with cache reuse — no persistent result storage is introduced
- Source article links are first-class: rendered as `<a href>` with title and outlet
- Quote attribution is visually distinct and outlet-linked where a URL is present
- `KPAResult` now has two concrete consumers, which tightens pressure to keep the schema stable and backward-compatible
- Future capabilities (saved result history, side-by-side strategy comparison, embeds) are straightforward to add to the SPA
- **Negatives:** frontend and pipeline types are coupled through shared source; API latency (~5–30 s) requires explicit loading states in the UI; results are not durable — a server restart or cache eviction means recomputation

## 🧠 Retrospective Notes

- Doc-driven design worked well here: writing the "Before/After" first clarified that the pipeline needed no changes, only a new adapter — this kept scope tight.
- The decision to reuse `src/cache.ts` rather than introducing a DB was deliberate scope control; revisit if the server needs to run as a deployed service rather than a local tool.

## 🔗 Where to Look Now

- Pipeline contract: `src/models.ts` (`KPAResult`, `KeyPoint`, `Quote`)
- HTTP API: `src/server.ts`
- SvelteKit app: `web/`
- CLI (unchanged): `src/cli.ts`, `src/display.ts`
- Cache layer: `src/cache.ts`

## 🗂️ One-Sentence Summary

"Added a fully async SvelteKit SPA and thin HTTP API adapter (`src/server.ts`) so KPA results render in the browser with clickable article links, formatted quotes, and attribution — while leaving the existing CLI and pipeline entirely unchanged."
