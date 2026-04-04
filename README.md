# Key Points Analysis — TypeScript MVP

![TypeScript](https://img.shields.io/badge/typescript-5.8-blue.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

TypeScript port of the [rnd-kpa](../rnd-kpa) proof of concept for **Key Points Analysis (KPA)** — a core OBENA feature that distills current op-ed and news content around a topic into structured key points with attributed quotes.

**Goal:** Clean, frontend-ready TypeScript pipeline for demo integration.

---

## What It Does

Given a topic query (e.g., `"Iran"`):

1. **Fetches** relevant op-ed content via Firecrawl's search API (opinion-filter applied automatically)
2. **Extracts** structured key points via Claude (Anthropic SDK), with parallel per-source pass
3. **Returns** a typed `KPAResult`: named key points, each with attributed grab quotes
4. **Caches** all external API calls to disk to support fast iteration without re-spending credits

---

## Output Shape

```typescript
const result: KPAResult = {
  query: 'Iran',
  strategy: 'bottom-up',
  keyPoints: [
    {
      title: 'Western sanctions are counterproductive',
      summary: 'Several analysts argue that sanctions have strengthened hardliners...',
      quotes: [
        {
          text: 'Sanctions have done little but consolidate power around the regime.',
          author: 'Jane Smith',
          outlet: 'The Atlantic',
          url: 'https://...',
        },
      ],
    },
  ],
  sourcesAnalyzed: 9,
  generatedAt: '2026-04-03T21:58:39.059Z',
  cacheHit: false,
};
```

---

## Setup

```bash
pnpm install

cp config/.env.secrets.example config/.env.secrets
# Edit config/.env.secrets: set ANTHROPIC_API_KEY and FIRECRAWL_API_KEY
```

---

## Usage

**CLI:**

```bash
pnpm kpa "Iran"                                  # default (bottom-up, pretty output)
pnpm kpa "Iran" --strategy top-down
pnpm kpa "Iran" --output json --out              # writes to /tmp/kpa-iran.json
pnpm kpa "Iran" --output json --out /path/to/file.json
pnpm kpa "Iran" --num-sources 10 --force-refresh
```

**TypeScript API** (e.g. in a Next.js route or server action):

```typescript
import { pipeline } from './src/index.js';

const result = await pipeline('Iran');
// or: await pipeline('Iran', { strategy: 'top-down', numSources: 15 })

for (const kp of result.keyPoints) {
  console.log(`## ${kp.title}`);
  console.log(kp.summary);
  for (const q of kp.quotes) {
    console.log(`  "${q.text}" — ${q.author}, ${q.outlet}`);
  }
}
```

**Web UI (SvelteKit):** The `web/` app is a small interface for the same pipeline: enter a topic, pick **bottom-up** or **top-down**, then **Analyse**. Results show key points, quotes, source counts, and whether the Firecrawl search step used disk cache. The address bar includes `?topic=…` so you can bookmark or share a link; loading a URL with that query runs the analysis on page load.

Development — run the API and the SvelteKit dev server in two terminals (Vite proxies `/api` to the Hono server):

```bash
pnpm dev:api    # Hono + pipeline on http://localhost:3000 (override with PORT)
pnpm dev:web    # SvelteKit + Vite (default http://localhost:5173 — see terminal output)
```

Open the dev URL Vite prints, ensure `pnpm dev:api` is running first, then use the form.

Production — build the static site and serve it together with the API from one process:

```bash
pnpm build:web
pnpm start      # API + static UI from web/build (default http://localhost:3000)
```

---

## Project Structure

```text
mvp/
├── src/
│   ├── models.ts           # KPAResult, KeyPoint, Quote (Zod schemas)
│   ├── pipeline.ts         # runKpa() orchestrator
│   ├── server.ts           # Hono: POST /api/kpa + static web/build
│   ├── fetcher.ts          # Firecrawl wrapper with opinion-filter + caching
│   ├── prompts.ts          # Claude extraction prompts (identical to rnd-kpa)
│   ├── cache.ts            # Flat-file JSON disk cache (mirrors rnd-kpa cache.py)
│   ├── settings.ts         # dotenv + Zod config singleton
│   ├── display.ts          # chalk terminal renderer
│   ├── logger.ts           # pino structured logger
│   ├── cli.ts              # commander CLI entry point
│   ├── index.ts            # Public API (pipeline(), printResult(), types)
│   └── extraction/
│       ├── bottom-up.ts    # Parallel pass-1, single synthesis pass-2
│       └── top-down.ts     # Two-pass: identify key points, then retrieve quotes
├── web/                    # SvelteKit 5 + Tailwind (pnpm -C web … or root dev:web / build:web)
├── config/
│   ├── .env.secrets.example
│   └── .env.secrets        # API keys (not committed)
└── tsconfig.json
```

---

## Code Quality

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint src
pnpm format      # prettier --write src
pnpm lint:md     # markdownlint-cli2
pnpm format:md   # markdownlint-cli2 --fix
pnpm test        # vitest run
```

Pre-commit (Husky): Prettier + ESLint + markdownlint-cli2 auto-fix on staged files.
Pre-push: full `tsc --noEmit`.

---

## Tech Stack

| Tool                                 | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| TypeScript 5.8                       | Runtime                                              |
| pnpm                                 | Package manager                                      |
| Firecrawl (`@mendable/firecrawl-js`) | Content discovery + scraping                         |
| Anthropic SDK (`@anthropic-ai/sdk`)  | Claude API (LLM extraction)                          |
| Zod                                  | Output schema + validation                           |
| Flat-file JSON cache                 | Disk-based API response cache                        |
| ESLint + Prettier                    | TS/JS/JSON/YAML formatting + lint (mirrors `obena/apps/frontend`) |
| markdownlint-cli2                    | Markdown lint + fix (extends `tools/standards/markdownlint.yaml`) |
| Husky + lint-staged                  | Git hooks                                            |
| vitest                               | Tests                                                |
| SvelteKit + Vite + Tailwind (`web/`) | Browser UI for KPA (dev proxy to `pnpm dev:api`)     |

---

Copyright 2025 OBENA. Internal Use Only.
