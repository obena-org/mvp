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

---

## Project Structure

```
mvp/
├── src/
│   ├── models.ts           # KPAResult, KeyPoint, Quote (Zod schemas)
│   ├── pipeline.ts         # runKpa() orchestrator
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
pnpm test        # vitest run
```

Pre-commit (Husky): Prettier + ESLint auto-fix on staged files.
Pre-push: full `tsc --noEmit`.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript 5.8 | Runtime |
| pnpm | Package manager |
| Firecrawl (`@mendable/firecrawl-js`) | Content discovery + scraping |
| Anthropic SDK (`@anthropic-ai/sdk`) | Claude API (LLM extraction) |
| Zod | Output schema + validation |
| Flat-file JSON cache | Disk-based API response cache |
| ESLint + Prettier | Linting + formatting (mirrors `obena/apps/frontend`) |
| Husky + lint-staged | Git hooks |
| vitest | Tests |

---

Copyright 2025 OBENA. Internal Use Only.
