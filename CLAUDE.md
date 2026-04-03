# OBENA Key Points Analysis — Claude Code Guide

TypeScript MVP that distills op-ed/news content on a topic into structured key points with attributed quotes. Pipeline: Firecrawl search → Claude extraction → typed `KPAResult`.

## Commands

```bash
pnpm kpa "Iran"               # run CLI (tsx, no build step)
pnpm typecheck                # tsc --noEmit
pnpm lint                     # eslint src
pnpm format                   # prettier --write src
pnpm test                     # vitest run
pnpm test:watch               # vitest watch
```

Pre-commit hook: Prettier + ESLint auto-fix on staged files.
Pre-push hook: full `tsc --noEmit`.

## Architecture

```text
src/index.ts          — public API: pipeline(query, opts?)
src/pipeline.ts       — runKpa() orchestrator (cache → fetch → extract → cache)
src/models.ts         — Zod schemas: Source, KeyPoint, Quote, KPAResult
src/fetcher.ts        — Firecrawl wrapper (opinion-filter + disk cache)
src/cache.ts          — flat-file JSON disk cache keyed by stable hash
src/settings.ts       — Zod config singleton; throws ConfigError on missing keys
src/prompts.ts        — all Claude prompt strings (keep identical to rnd-kpa)
src/extraction/
  bottom-up.ts        — parallel per-source pass-1 → single synthesis pass-2
  top-down.ts         — global key-point identification → per-point quote retrieval
src/cli.ts            — Commander CLI entry point
src/display.ts        — chalk terminal renderer
src/logger.ts         — pino structured logger
```

## Key conventions

- **Package manager:** pnpm only.
- **Execution:** `tsx` — no build step; import paths use `.js` extension for `.ts` source files.
- **Modules:** ESM only (`"type": "module"`). No `require`.
- **Config/secrets:** always via `getSettings()` from `src/settings.ts`. Never read `process.env` directly outside that file.
- **Logging:** pino (`src/logger.ts`). `console.*` is only allowed in `display.ts`, `logger.ts`, `cli.ts`.
- **Validation:** Zod for all external data. Infer TypeScript types with `z.infer<>`.
- **Strict TS:** `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on — never use `!` assertions.
- **Imports:** grouped and alphabetized: 1) `node:` builtins, 2) external packages, 3) internal/relative.
- **Formatting:** tabs for `.ts`/`.js`, 2-space for `.json`/`.yaml`, single quotes, trailing commas, 100-char lines.

## Secrets

Copy `config/.env.secrets.example` → `config/.env.secrets` and set:

- `ANTHROPIC_API_KEY`
- `FIRECRAWL_API_KEY`

Optional: `CACHE_DIR`, `SEARCH_CACHE_TTL_SECONDS`, `NUM_SOURCES` (default: 20), `CLAUDE_MODEL` (default: `claude-sonnet-4-6`).
