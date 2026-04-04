---
title: 'Add source favicons to web UI quote cards'
date: 2026-04-03
status: complete
owner: Mike Albrecht
related-issues: []
related-prs: []
related-docs:
  - docs/_history/2026-04-03-sveltekit-web-frontend.md
tags: [frontend, web-ui, favicons, ux]
---

## 🧭 Context

The web UI renders each quoted source with outlet name, author, and a "Read article" link — but no visual brand marker. At a glance, quotes from the New York Times, The Atlantic, and a mid-tier blog look identical. The outlet name is small, dimmed text; users must read it to identify the source brand.

Favicons are a common compact source-identity affordance in content feeds and search UIs. Adding them to quote footers would let users scan source diversity and credibility at a glance.

## 🎯 Decision

We use a third-party favicon proxy API directly in the SvelteKit component — no backend changes, no npm additions, no new pipeline fields. The favicon `<img>` is constructed purely from the `url` field already present in each `Quote`.

- Use the DuckDuckGo favicon proxy: `https://icons.duckduckgo.com/ip3/{hostname}.ico`
- Render as a small inline `<img>` (16×16) in the quote footer, beside the outlet name
- Use `onerror` to hide the image silently if the proxy returns nothing
- No changes to `Source`, `Quote`, `KPAResult`, or any server code

### 🔄 Before / After

Before:
quote footer: `— Author · Outlet  [Read article ↗]`

After:
quote footer: `[favicon] — Author · Outlet  [Read article ↗]`

### 🧩 Mental Model

- This is a pure rendering detail — the favicon proxy is a CDN-style URL transform, not a data dependency
- The `url` field on `Quote` already encodes the source hostname; no new data is needed
- Think of it like formatting a date: the data is already there, the display layer just renders it differently

## 🔍 Key Tradeoffs

### Option A — External favicon proxy (chosen)

DuckDuckGo (`https://icons.duckduckgo.com/ip3/{hostname}.ico`) and Google (`https://www.google.com/s2/favicons?domain={hostname}&sz=32`) both offer free, unauthenticated favicon proxy endpoints. DuckDuckGo is preferred: it does not associate lookups with a Google account or session, and it consistently returns `.ico` files that render cleanly at 16px.

- Zero backend changes; zero npm packages
- One `<img>` tag per quote, rendered by the browser — no server-side fetching or caching
- Typically returns an icon or fallback asset; hard failures degrade gracefully via `onerror` (image hidden, no broken-icon flash)
- Tradeoff accepted: browser makes one third-party request per unique source domain; at ≤20 sources browser caching means repeated domains (e.g. multiple NYT quotes) incur only one network round-trip
- **Product/privacy note:** favicon lookups are third-party requests keyed by source hostname. For a POC this is an acceptable tradeoff; a future privacy-hardened deployment could proxy the favicon endpoint server-side to avoid leaking source domains to a third party

### Option B — Extract from already-fetched HTML

Firecrawl already retrieves `item.html` during the search pass (used for author extraction via `unfluff`). In principle, `<link rel="icon">` tags could be parsed there and stored on `Source`/`Quote`.

Rejected: even when article HTML includes icon declarations, coverage and consistency are insufficient to rely on as the primary source — `<link rel="icon">` typically lives in the root domain's `<head>`, not in individual article pages. We'd need a separate root-URL fetch per domain for reliable results, negating the "use what we already have" advantage.

### Option C — Clearbit Logo API

`https://logo.clearbit.com/{hostname}` returns high-resolution company logos (not just favicons). Looks polished, free tier is generous.

Rejected for now: returns 404 for smaller outlets and blogs; the `onerror` fallback would produce inconsistent visual weight (some sources get a logo, many get nothing). The Google/DDG proxy consistently returns _something_ for every domain, which is the right UX for a list of mixed sources.

**Option D — npm favicon-fetching library (e.g. `get-favicon`, `node-favicon`)**

These libraries fetch and resolve favicon URLs server-side, storing results in the pipeline or cache.

Rejected: adds a dependency, requires backend changes, introduces per-source HTTP requests during pipeline execution, and complicates the `Source`/`Quote` schema. None of the available packages have meaningfully better coverage than a proxy API. Over-engineered for a POC.

## 🔄 Migration Shape

Pure additive frontend change. No schema changes, no server changes, no cache invalidation. The `onerror` handler ensures zero visual regression if the proxy is unavailable.

## 📌 Enduring Constraints

- Favicon display depends on an external CDN; it should degrade gracefully (hidden, not broken) if unavailable
- The proxy URL is constructed from `quote.url` hostname — if a `Quote` ever carries a non-HTTP URL (e.g. a DOI link), the fallback `onerror` must suppress the broken image
- Do not fetch favicons server-side or store them in `Source`/`Quote`; that would couple pipeline caching to favicon CDN availability

## 📈 Consequences

- Source brand identity is immediately scannable in the quote footer
- No changes required to the pipeline, models, cache, or server
- DuckDuckGo proxy is a soft runtime dependency — the feature degrades to text-only if the CDN is down, which is acceptable for a POC
- If Clearbit-quality logos are needed in a future version, the `<img src>` swap is a one-line change

## 🔗 Where to Look Now

- Quote rendering: `web/src/routes/+page.svelte` (quote `<blockquote>` footer); favicon URL constructed via a local `faviconUrl(url: string): string` helper to keep URL parsing out of the template
- Quote model: `src/models.ts` (`QuoteSchema.url`)
- SvelteKit frontend history: `docs/_history/2026-04-03-sveltekit-web-frontend.md`

## 🗂️ One-Sentence Summary

"Added source favicons to web UI quote cards using the DuckDuckGo favicon proxy, constructed from the already-present `quote.url` hostname — no backend changes, no npm additions, no schema changes."
