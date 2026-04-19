---
description: Audit a library against its docs (via context7), apply best-practice fixes, simplify, and open a PR.
argument-hint: <library-name> [--dry-run]
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent, mcp__plugin_context7_context7__resolve-library-id, mcp__plugin_context7_context7__query-docs
---

# Audit Package: $ARGUMENTS

End-to-end workflow to review a single library against its docs, apply best-practice fixes for the version pinned in this repo, simplify the diff, and prepare a PR.

**Required plugin**: `context7` (for `mcp__plugin_context7_context7__resolve-library-id` and `mcp__plugin_context7_context7__query-docs`).
**Required skill**: `simplify` (built-in via the user's environment).

If `$ARGUMENTS` is empty, ask the user which library to audit and stop until they answer. If `--dry-run` is present, do Phases 1–3 only and report findings without editing files.

---

## Phase 1 — Identify the installed version and call sites

1. Read `package.json` (or the appropriate manifest) and grep for the library. Record:
   - The version range in the manifest (e.g., `"^1.2.9"`).
   - The actual installed version from the lockfile or `node_modules/<pkg>/package.json`.
2. Find every call site with Grep. Cap to the top ~20 hits across `src/` for context. Read the most central file in full.
3. Note adjacent libraries from the same family (e.g., `@langchain/core` when auditing `@langchain/langgraph`) — relevant for compat but **do not** audit them in this run.

**Stop and report** if the library is not installed, has zero call sites, or appears only in tests / dead code. Ask the user whether to continue.

## Phase 2 — Resolve docs and check for a newer stable version

1. Call `mcp__plugin_context7_context7__resolve-library-id` with the library name. Pick the highest-reputation match. If multiple match, list them and ask.
2. Note the latest stable version visible in the resolver output. If newer than the installed version, flag it with: current → latest, an estimated risk level (patch/minor/major), and whether breaking changes are likely. **Do not upgrade in this workflow** — surface the recommendation only.
3. Call `mcp__plugin_context7_context7__query-docs` with the resolved `libraryId` (pin the installed version where supported, e.g., `/org/project/1.0.8`). Query for: idiomatic API surface, recommended patterns for the use case observed in Phase 1, deprecations, and common foot-guns. Hard cap: **3 query-docs calls** total per the tool's own limit.

## Phase 3 — Audit current usage against best practices

Compare what the docs recommend against what the codebase does. Produce a punch list with each item categorized as:

- **High-value (correctness / cost / UX)** — bugs, leaks, broken protocols, missing cancellation, etc.
- **Lower-value (polish)** — type safety, consistency, comment cleanup, redundant state.

For each item: file, line, what's wrong, suggested fix, and risk. Call out trade-offs explicitly. **Stop here** and ask the user which items to apply (or "all"). If `--dry-run`, stop after this phase.

## Phase 4 — Implement the chosen fixes

1. Create or update a TaskCreate list mirroring the chosen punch-list items so progress is visible.
2. Apply edits one item at a time. Mark each task `completed` as soon as its edit lands.
3. After each substantive edit, run typecheck on the modified files only (`npx tsc --noEmit 2>&1 | grep '<modified-file>'`) and the most relevant unit tests (`npx vitest run <test-file>`). Don't move on if either fails.
4. If a fix balloons in scope or becomes risky, stop and check with the user before continuing.

## Phase 5 — Simplify pass

Invoke the built-in `/simplify` skill on the working diff. The skill launches three review agents (reuse, quality, efficiency) in parallel and applies their findings. Apply only items that don't expand scope; explicitly skip and note anything out-of-scope or already-documented.

## Phase 6 — Prepare the PR

1. Show `git status`, `git diff --stat`, and `git log -5 --oneline`. Confirm the branch is the right place for this work — if it's `main` / `master` or a long-lived integration branch, **stop and ask** whether to create a new branch.
2. Group commits logically (one per phase is usually right: idiom alignment, polish, simplify). Use HEREDOC commit messages with the project's style and the standard `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer. Never `--amend` and never `--no-verify`.
3. After committing, ask whether to push and open a PR. If yes, push to the tracked remote branch (or set upstream with `-u`) and run `gh pr create` with:
   - Title under 70 characters, summarizing the package and outcome (e.g., "refactor(langgraph): align with v1 idioms and harden agent SSE route").
   - Body with `## Summary`, `## Changes` (one bullet per commit), `## Test plan` (the verification commands you actually ran), and an explicit `## Skipped` section listing items deliberately not addressed and why.
4. Return the PR URL.

---

## Guardrails

- **Never upgrade the package version** as part of this workflow. That's a separate decision with its own review.
- **Never `git push --force`** or modify branches other than the current one without asking.
- **Never delegate synthesis to subagents** — agents gather findings; you decide what to fix. Apply edits with the main tools, not via agents.
- **Stay scoped to this library.** If audit findings touch unrelated files, list them under "Skipped" with a one-line reason.
- Keep the user in control at the boundaries: pick library (Phase 1), pick fixes (Phase 3), pick to push/open PR (Phase 6).
