---
title: 'Enrich Source.author via Unfluff HTML parsing in fetcher'
date: 2026-04-03
status: completed
owner: Mike Albrecht
related-issues: []
related-prs: []
related-docs:
  - docs/_history/2026-04-03-sveltekit-web-frontend.md
tags: [fetcher, author, metadata, unfluff, attribution]
---

## 🧭 Context

Quote attribution in the UI currently shows "— New York Post" but almost never shows an author name. The `Source.author` field exists in the schema and is passed to Claude during extraction, but it is nearly always `null` — not because the information is unavailable on the page, but because of two gaps in the fetch pipeline:

1. `fetcher.ts` attempts to read `author` and `og:author` from Firecrawl metadata, but these OpenGraph tags are not standard on news/op-ed sites; in practice the field resolves to `null` for the vast majority of sources.
2. The Firecrawl search call only requests `formats: ['markdown']`, so raw HTML is never fetched — there is nothing to parse the byline from.

The extraction strategies (`bottom-up.ts`, `top-down.ts`) pass `source.author` verbatim to Claude and do not ask Claude to infer the author from content. So the problem is entirely upstream: `Source.author` is not being populated.

## 🎯 Decision

Add `html` to the Firecrawl `scrapeOptions.formats` and run `unfluff` on the raw HTML inside `_parseDocuments()` to extract the article byline. The extracted author populates `Source.author`, which flows through the existing extraction pipeline and the UI unchanged.

- Add `unfluff` as a runtime dependency
- In `_parseDocuments()`, when `item.html` is present, call `unfluff(item.html)` and resolve `Source.author` by the following precedence rule (first non-empty wins): 1) Unfluff `.author`, 2) Firecrawl metadata `author`/`og:author`, 3) `null`
- Apply minimal normalization to the resolved author string before storing it (see Enduring Constraints)
- Introduce `_SOURCE_SCHEMA_V` as a separate version constant for cached `Source` shape — distinct from `_OPINION_FILTER_V` — and bump it to invalidate cached sources that lack HTML-derived author data
- Add pino debug/info instrumentation at the resolution step to measure Unfluff yield vs. metadata fallback yield across the corpus
- Domain-specific extraction overrides are out of scope for this change; the extension point for them is inside `_parseDocuments()` if needed later
- No changes to `src/models.ts`, `src/extraction/`, or the API/UI layer — `Source.author` already exists and flows through correctly

### 🔄 Before / After

Before:
Firecrawl (markdown only) → metadata `og:author` (rarely set) → `Source.author = null`
Claude uses null author → quotes display "— New York Post"

After:
Firecrawl (markdown + html) → Unfluff parses byline from HTML → `Source.author = "Steve Cuozzo"`
Claude uses populated author → quotes display "— Steve Cuozzo · New York Post"

### 🧩 Mental Model

- `Source.author` is the correct place for this data — it's already the input to extraction
- Unfluff is a content extraction layer, not a new data model; it runs at fetch time, not extraction time
- This change is entirely inside `fetcher.ts._parseDocuments()` — the rest of the pipeline is untouched
- The author field remains best-effort: Unfluff uses heuristics and will miss some bylines

### 🧾 Stable Terms

`Source.author` → The pre-extracted author passed to Claude; populated from HTML parsing at fetch time, not inferred from content at extraction time  
`_SOURCE_SCHEMA_V` → Version constant for the cached `Source` object shape; bump this (not `_OPINION_FILTER_V`) when the structure of what is stored per source changes  
Unfluff → Node.js article metadata extractor; used specifically for structured byline extraction from raw HTML

## 🔍 Key Tradeoffs

- **Unfluff over asking Claude to infer author:** Asking Claude to extract the author from markdown content would work but adds latency and token cost per source on every run, including cache hits where the author is already known. Unfluff runs once at fetch time and the result is cached.
- **Adding `html` format increases Firecrawl payload size:** HTML is substantially larger than markdown. This increases Firecrawl API response sizes and potentially API costs. Mitigation: the result is cached, so the overhead applies only on initial fetches. We do not store the raw HTML in the cache — only the parsed `Source` object.
- **Unfluff over other extractors (node-html-metadata, article-parser, metascraper):** Unfluff is purpose-built for news article extraction and targets the same byline-detection signals (schema.org, OpenGraph, itemprop, byline text patterns) that matter most for op-ed/news content. Other extractors treat author as a secondary concern; Unfluff treats it as a first-class output. Actual yield on this corpus should be confirmed during validation.
- **Cache version bump is a breaking cache change:** All cached sources will be re-fetched on next run. This is intentional — existing cached sources do not have HTML-derived author data. The user-visible impact is one cold-cache pipeline run per query after the upgrade.

## 📌 Enduring Constraints

- Unfluff author extraction is heuristic; it will be null for some articles (paywalled, unusual byline markup, multi-author pieces). `Source.author` must remain `nullish` in the schema.
- Raw HTML must NOT be stored in the cache — only the parsed `Source` object. HTML is large and short-lived; caching it would bloat the cache and provide no benefit since Unfluff is already run at parse time.
- `_SOURCE_SCHEMA_V` must be bumped with every change that affects the shape of a cached `Source` object. `_OPINION_FILTER_V` is reserved for changes to the search query semantics only. The two version constants must not be conflated.
- `Source.author` comes from the fetch layer, not the extraction layer. Claude must never be asked to infer author from content — this would create a correctness divergence between cache-hit and cache-miss paths.
- **Author normalization contract (minimal, non-negotiable):** before storing, trim whitespace; strip a leading `"By "` prefix (case-insensitive); reject strings that are clearly not a person name — specifically: empty after trim, equal to the outlet name (case-insensitive), or equal to a known placeholder like `"staff"`, `"editors"`, `"editorial board"`. Beyond these rules, preserve the extracted string as-is: do not split multi-author strings, do not remove role suffixes (e.g. `"Jane Smith, Columnist"`), preserve original capitalization.

## 🔬 Observability

Add pino log entries in `_parseDocuments()` at the per-source level:

- `source_html_present` — HTML was available for Unfluff to parse (helps measure Firecrawl HTML yield)
- `source_author_unfluff` — Unfluff returned a non-empty author (after normalization)
- `source_author_metadata` — metadata fallback returned a non-empty author
- `source_author_conflict` — both sources returned a value but they differ (signals whether Unfluff is adding new information or just confirming metadata)
- `source_author_null` — neither source returned a usable value

The conflict log in particular will quickly reveal whether Unfluff materially outperforms metadata on the actual corpus, or whether domain-specific overrides are needed.

## ✅ Validation Plan

Before closing this change:

1. Test 10–20 representative op-ed domains (NYT, WaPo, NYPost, Guardian, WSJ, Atlantic, Politico, etc.) — verify author appears in UI for known bylines
2. Verify `_SOURCE_SCHEMA_V` bump forces re-fetch (confirm no stale cached sources survive)
3. Verify graceful null fallback — run a query against a domain Unfluff does not support and confirm attribution shows outlet-only without errors
4. Verify HTML is not present in cache artifacts (inspect `.cache/kpa/` files)
5. Check `source_author_conflict` log entries — if any outlets are consistently incorrect, note them as future candidates for domain overrides

## 📈 Consequences

- Quotes will display "— Author · Outlet" instead of "— Outlet" for the majority of sources that include structured byline markup
- Attribution quality is directly improved with no change to the extraction prompt, the API contract, or the UI
- The `html` format request makes Firecrawl API calls slightly heavier but the impact is isolated to the cache-miss path
- Future metadata enrichment (publish date, tags, section) follows the same pattern: Unfluff already extracts these fields

## 🧨 Surprises / Edge Cases

- Some outlets (e.g. Reuters, AP) use byline patterns that Unfluff does not detect. For these, `Source.author` will remain null and the display gracefully falls back to outlet-only attribution.
- If `item.html` is missing from a Firecrawl response (e.g. a scrape error or JS-rendered page), the code falls through to the existing `og:author` metadata check. This is not an error path.

## 🔗 Where to Look Now

- Fetch layer: `src/fetcher.ts` (`_parseDocuments`, `searchSources`)
- Source schema: `src/models.ts` (`SourceSchema`)
- Extraction (author consumer): `src/extraction/bottom-up.ts` (line ~130), `src/extraction/top-down.ts`
- UI display: `web/src/routes/+page.svelte` (attribution rendering)

## 🗂️ One-Sentence Summary

"Add Unfluff-based HTML byline extraction to `fetcher.ts` so `Source.author` is populated from article markup, enabling 'Author · Outlet' attribution in the UI without any changes to the extraction or display layers."
