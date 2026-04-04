---
title: "Real-time progress streaming for the KPA web UI"
date: 2026-04-03
status: complete
owner: Mike Albrecht
related-issues: []
related-prs: []
related-docs:
  - docs/_history/2026-04-03-sveltekit-web-frontend.md
tags: [web, sse, streaming, ux, pipeline]
---

## 🧭 Context

The KPA pipeline takes 15–45 seconds on a fresh (non-cached) request. The web UI showed a
single spinner with the static message "Fetching and analysing sources — this may take up to
30 seconds…" for the entire duration. Users had no signal that anything was happening after
the first second — no way to distinguish a slow run from a hung one.

The pipeline has three natural stages visible at the source level: searching for articles
(Firecrawl), per-source extraction (N parallel Claude calls), and synthesis (one final call).
Pass-1 extraction is the largest window of time and the easiest to report incrementally because
each source settles independently.

## 🎯 Decision

We added a server-sent events (SSE) streaming endpoint (`GET /api/kpa/stream`) that emits typed
progress events as the pipeline runs, and updated the frontend to consume them via `EventSource`.
The existing `POST /api/kpa` endpoint is preserved for programmatic / non-streaming use.

Key outcomes:

- Add `GET /api/kpa/stream?topic=…&strategy=…&numSources=…&forceRefresh=…` → streams SSE events
- Thread an `onProgress` callback through `runKpa` → `extract` → `_pass1One` (no global emitter)
- Emit five event types: `status` (phase transitions), `source-done` (per-source pass-1 completion),
  `complete` (final result), `cache-hit` (instant result from cache), and `error`
- Replace the static loading banner in `+page.svelte` with a live progress indicator driven by
  `EventSource`

### 🔄 Before / After

Before:
    `POST /api/kpa` returns after full pipeline completes; UI shows a static spinner

After:
    `GET /api/kpa/stream` opens an SSE connection; UI updates phase label and source counter
    as each stage begins and as each pass-1 source finishes

### 🧩 Mental Model

- Not WebSockets; not a persistent channel — one SSE connection per user request, closed by the
  server when `complete` or `error` is emitted
- Not a publish/subscribe bus — just a typed callback threaded down the existing call stack
- The stream is a side-channel for observability; the `complete` event carries the full
  `KPAResult`, so the client needs nothing else

### 🧾 Contract Terms

`onProgress` → Typed callback `(event: ProgressEvent) => void` passed through `runKpa` and
`extract`; called at pipeline phase transitions and after each pass-1 source settles

`GET /api/kpa/stream` → SSE endpoint; emits `ProgressEvent` lines as `data: <JSON>\n\n`

`ProgressEvent` → Discriminated union. Payload shapes are guaranteed — no extra fields will
be added to existing types without a new history entry:

```typescript
// Phase transition — emitted at the start of each pipeline stage
{ type: 'status'; phase: 'searching' | 'processing' | 'synthesizing'; message: string }

// One per pass-1 source, as each settles (concurrent); ok=false means extraction failed for that source
{ type: 'source-done'; completed: number; total: number; url: string; ok: boolean }

// Emitted instead of the full sequence when the result cache is warm
{ type: 'cache-hit'; result: KPAResult }

// Terminal success; result is always a complete, schema-valid KPAResult — never partial
{ type: 'complete'; result: KPAResult }

// Terminal failure; no partial result is included
{ type: 'error'; message: string }
```

**Ordering guarantees clients may rely on:**

- `status: searching` is always the first event on a fresh run
- `status: processing` arrives only after `searchSources` resolves; `total` in subsequent
  `source-done` events matches the actual number of sources found
- `source-done.completed` is strictly monotonically increasing; no two events share the same value
- `status: synthesizing` is emitted only after all `source-done` events have been written
- Terminal events (`complete`, `cache-hit`, `error`) are emitted exactly once and always last;
  no events follow a terminal event

### ⛔ Non-Goals

This change does not provide:

- Resumable or replayable streams (reconnect starts a fresh pipeline run)
- Bidirectional control (pause, cancel, steer the pipeline mid-run)
- Cross-request job identity or status polling
- Partial result streaming (key points are not emitted one-by-one as they complete)

## 🔍 Key Tradeoffs

**SSE over WebSockets.** The data flow is strictly unidirectional (server → client). WebSockets
would add unnecessary complexity: an upgrade handshake, ping/pong keep-alive, and a more involved
client API. SSE over HTTP is sufficient and simpler.

**GET + query params over POST + fetch streaming.** The browser's native `EventSource` only
supports GET. An alternative is `fetch()` + `ReadableStream` parsing (NDJSON over POST), which
preserves POST semantics but requires custom streaming logic on both sides. Since the topic
string and a handful of options are safely URL-encodable, we use GET + `EventSource` for the
standard API and simpler reconnect semantics.

**Callback injection over an event emitter.** A global `EventEmitter` or RxJS subject would
decouple pipeline stages from the transport but introduce implicit coupling and make unit testing
harder. Passing `onProgress` explicitly keeps the dependency graph explicit and the pipeline
testable without an SSE server.

**No fake progress for cache hits.** When the result cache is warm, the pipeline returns in
milliseconds. We emit a single `cache-hit` event immediately and close the connection — no
artificial delay or fabricated stage events.

## 🔄 Migration Shape

The new endpoint is additive. `POST /api/kpa` is unchanged; existing clients (CLI, tests, curl
scripts) are unaffected. The frontend switches from `fetchKpa` in `lib/api.ts` to a new
`streamKpa` helper that opens an `EventSource` and maps incoming events to reactive state.

## 📌 Enduring Constraints

- **Reconnect policy:** `EventSource` auto-reconnects on network drop. The server closes the
  connection after every terminal event (`complete`, `cache-hit`, `error`). A reconnect after
  a terminal event is harmless — the cache will be warm and a `cache-hit` event is returned
  immediately. A reconnect mid-run starts a brand-new pipeline execution; there is no resume.
  The client must call `eventSource.close()` on receiving any terminal event to prevent
  accidental re-runs.
- **Cancellation / disconnect:** If the client disconnects (tab close, `eventSource.close()`),
  the in-flight pipeline continues to completion in the background. The result is cached as
  normal. No cancellation mechanism is provided; this is intentional and out of scope.
- **Event volume:** Total event count per request is bounded at `3 + numSources + 1` — three
  `status` transitions, one `source-done` per source, one terminal. At the default of 20 sources
  this is 24 events. This is not a telemetry channel; the event rate is intentionally coarse.
- SSE does not work through HTTP/1.0 proxies that buffer the full response before forwarding.
  In practice this is not a concern for modern infra, but chunked transfer encoding must remain
  enabled (Hono's default).
- The `onProgress` callback must never throw; errors inside it must be caught and logged, not
  propagated into the pipeline.

## 📈 Consequences

- Users see a phase label ("Searching…", "Processing sources (0 / 20)…", "Synthesising…") that
  updates in real time during a fresh run
- Pass-1 source completions increment a counter in the UI, giving a concrete sense of progress
  through the longest stage
- Cache hits now show a distinct "loaded from cache" state rather than a momentary spinner
- The pipeline becomes instrumentable: any future consumer (metrics, admin dashboard) can attach
  a progress callback without modifying pipeline logic

## 🧨 Surprises / Edge Cases

**`EventSource` and POST:** confirmed that `EventSource` does not support non-GET methods or
custom headers. Query param encoding of topic/strategy is the correct solution — not a workaround.

**Pass-1 concurrency:** `Promise.allSettled` in `extract` runs all pass-1 calls in parallel.
The `onProgress('source-done')` callback fires from multiple concurrent async contexts; Hono's
`streamSSE` writer must be called serially. In practice Node.js's event loop serializes the
`write` calls, but the callback should guard against a closed stream (the user may close the tab
before pass-1 finishes).

**What to validate in tests:** event emission order (status → source-done × N → status:
synthesizing → complete), monotonic `completed` counter, `cache-hit` terminal path (no other
events emitted), closed-stream guard (no throw when writing after client disconnect), and one
frontend integration case confirming `EventSource` state transitions match the progress UI.

## 🔗 Where to Look Now

- Server endpoint: `src/server.ts` (`GET /api/kpa/stream`)
- Progress types: `src/models.ts` (`ProgressEvent`)
- Pipeline callback: `src/pipeline.ts` (`runKpa` `onProgress` parameter)
- Extraction callback: `src/extraction/bottom-up.ts`, `src/extraction/top-down.ts`
- Frontend: `web/src/lib/api.ts` (`streamKpa`), `web/src/routes/+page.svelte`

## 🗂️ One-Sentence Summary

"Added a `GET /api/kpa/stream` SSE endpoint and threaded an `onProgress` callback through the
pipeline so the web UI can display live phase labels and per-source pass-1 progress."
