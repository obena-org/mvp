# Vendored org standards (`tools/standards/`)

This directory holds **generated copies** of shared tooling from the organization **standards** repository. Files here are updated with **`sync-standards.sh`** (or `scripts/sync_standards.py` from a checkout), not by hand-editing the vendored configs in place.

## Why this exists

- **Single source of truth** lives in the `standards` repo; consumers pull reviewed updates via sync.
- **`VERSION`** records which tag or branch you last synced from (see that file next to this README).
- **Drift is visible** in normal `git diff` / PR review, similar to other vendored baselines.

## What not to do

- Do **not** “fix” shared Ruff rules only in this copy—change **`standards/python/ruff.toml`** upstream in the `standards` repo and re-sync.
- **Repo-local** Ruff overrides belong in the consumer’s root **`pyproject.toml`** (`extend`, `extend-per-file-ignores`, `known-first-party`, etc.). Copy from `standards` **`templates/repo-files/pyproject.toml`** and adjust package names.

## Workflow

1. Run the sync entrypoint from your consumer repo (often via `gh api … | bash -s` or a `just` recipe; see the `standards` repo **`docs/quickstart.md`**).
2. Prefer pinning **`--version`** to a **release tag**; omitting it resolves the **latest GitHub release**, with fallback to **`main`** if none exist.
3. Review **`git diff tools/standards/`**, commit, and push.

## Contents (typical)

| File | Role |
| --- | --- |
| `ruff.toml` | Vendored from `standards` repo `standards/python/ruff.toml` |
| `markdownlint.yaml` | Vendored **rules** (byte copy of `standards/markdown/.markdownlint.yaml`; no leading dot here—see **README § [Vendored filenames and dotfiles](../../README.md#vendored-filenames-and-dotfiles)**) |
| `pre-commit.yaml` | Baseline fragment to merge into `.pre-commit-config.yaml` |
| `README.md` | This file (synced from `standards` `templates/tools-standards/README.md`) |
| `VERSION` | Sync metadata (written by `sync-standards.sh` each successful sync) |

Use a **root `.markdownlint.yaml`** in the consumer repo with `extends: "tools/standards/markdownlint.yaml"` so editor, CLI, and pre-commit share one entrypoint (see **`templates/repo-files/.markdownlint.yaml`** in `standards`). For Ruff `extend` and pre-commit merge, see **`docs/adoption.md`** in the `standards` repository.
