# State resume — Wave 4 takeover (2026-05-08)

This document captures the orchestration state at the moment the orchestrator (me) took over from three Wave 4 implementation agents that hit Bash-permission walls and could not finish on their own. The work they produced is preserved on a single salvage branch on origin so nothing is lost.

## What's on `main`

Final main HEAD: `286f095` (PR #56 — Transform.pipe pairwise compatibility).

Everything from `designs/0002-total-compile-time-enforcement.md` Priority 1–3 has landed. Cluster H (research, Priority 4) was scoped down per user direction:

| Finding | Surface | Status |
|---|---|---|
| 22 | typed regex AST → template literals | **Dropped.** Out of scope; runtime regex check stays the source of truth. |
| 23 | `format` brands | **Already on main** — `FormatBrandInterface` is wired in `src/types/Infer.ts` and applied at the format-detection branch. No further work needed. |
| 24 | `multipleOf` bounded → literal union | **In flight, salvaged checkpoint on `docs/declare-supported-dialect`** (see below). |
| 25 | `uniqueItems` literal-element union → distinct-tuple narrowing | **In flight, salvaged checkpoint on `docs/declare-supported-dialect`**. |
| 26 | `contains` array brand | **Already on main** — `ContainsBrandInterface` is wired. No further work needed. |

## Salvaged checkpoint branch

**`origin/docs/declare-supported-dialect`** at commit `fa231fe`. This branch carries TWO accidentally-merged efforts that the dispatched agents cross-contaminated when they shared the same checkout (no `isolation: worktree` was set on the dispatch):

1. **Docs dialect declaration** (Task #25). Touched `docs/getting-started.md`, `docs/index.md`, `docs/references.md`, `docs/schemas.md`, `CHANGELOG.md`. Adds the explicit "JSON Schema draft 2020-12" declaration to each user-facing doc page.
2. **Finding 24 — `multipleOf` bounded literal-union narrowing**. Touched `src/types/ConstraintBrands.ts`, `src/types/Infer.ts`, `test/types/multiple-of-bounded.test.ts`, plus a CHANGELOG bullet.
3. **Finding 25 — `uniqueItems` literal-element distinct-tuple narrowing** (incomplete, only the test file landed). Touched `test/types/unique-items.test.ts`.
4. **`test/types/format-brands.test.ts`** (incidental). A tests-only addition from the killed format-brands agent. Verifies what's already wired on main; can be merged as-is to harden the test suite or dropped without losing capability.

The branch is a WIP dump; the commits are not split semantically. Any one of three things can happen next:

### Option A — split into three clean PRs (recommended)

Walk back through `fa231fe` and `62c62a6` and partition by file path:
- `docs/declare-supported-dialect`: `docs/**` + the dialect-related CHANGELOG bullet.
- `feat/wave4-multiple-of-bounded`: `src/types/ConstraintBrands.ts` (multipleOf-related changes) + `src/types/Infer.ts` (multipleOf branch) + `test/types/multiple-of-bounded.test.ts` + the multipleOf CHANGELOG bullet.
- `feat/wave4-unique-items-tuple`: `test/types/unique-items.test.ts` plus whatever `Infer.ts` changes the agent intended (review the diff vs main; the agent reported "no source-file changes to Infer.ts were needed", suggesting tests-only — verify).

Suggested dispatch:
```
Single Sonnet agent, isolation: worktree. Hand it origin/docs/declare-supported-dialect at fa231fe.
Briefing: split this checkpoint into three clean branches by file-path partition.
For each new branch: rebase onto origin/main, run type-check + lint + test:types,
push, open PR with the title from designs/0002.
```

### Option B — squash and ship as one

Fold all of the above into a single `chore/wave4-checkpoint` PR. Honest CHANGELOG with three bullets (dialect, multipleOf, uniqueItems test). Loses semantic cleanliness but lands fast.

### Option C — start fresh on the remaining findings

Reset `feat/wave4-*` branches to origin/main. Re-dispatch tighter agents per finding. Use the checkpoint as a reference, not as a starting point. Faster than untangling if the checkpoint is mostly skeletal.

## Killed / cancelled agents

| Agent | Cluster | Why stopped |
|---|---|---|
| `a5996558028653bfc` | Finding 24 multipleOf | Bash permission denials prevented `git status` / `git push`. Committed work to wrong branch (`docs/declare-supported-dialect`), reported and exited. |
| `aa731fa74bf3a1d3b` | Finding 25 uniqueItems | Sent stand-down before significant work landed; only `test/types/unique-items.test.ts` exists. Acknowledged, exited. |
| `aee3c29df00c5205d` | Docs dialect declaration | Bash restrictions; reported docs work staged but never committed (orchestrator picked up the staged changes via the salvage commit). |

All three earlier-cancelled "format / contains / regex / multipleOf / uniqueItems" agents from the first parallel dispatch were rejected before they ran (the user halted the dispatch).

Wave 4 implementation worktrees still exist under `.claude/worktrees/agent-{id}/` and may have additional staged or stashed state. Audit before deleting.

## Settings hygiene

`.claude/settings.local.json` accumulated permission additions during the agent runs. The main worktree was reset to origin during the takeover; verify no security-relevant entries leaked into the committed history before the next push.

## Outstanding tasks (from the in-process task list)

| # | Subject | State |
|---|---|---|
| 18 | Dispatch implementation agents in parallel batches | in_progress (Wave 4 only) |
| 22 | Dispatch Wave 4: Findings 24 + 25 | in_progress; needs the split decision above |
| 23 | Cut 0.4.0 release once all clusters merged | pending; gated on Wave 4 |
| 25 | Declare canonical JSON Schema dialect in docs | pending; salvaged into checkpoint |
| 26 | User docs review gate before 0.4.0 release | pending; gated on Wave 4 |

## Lessons baked in for the next dispatch

1. Always pass `isolation: "worktree"` so agents do not share the orchestrator checkout.
2. Give exact line numbers / function names — `Infer.ts` line ~313 (string format), ~331 (multipleOf), ~338 (contains), ~344 (uniqueItems) — so agents jump to the seam instead of grepping.
3. State explicitly: "Do not re-explore the codebase. Use the design-doc section + the line numbers above. Read at most 3 files."
4. Set a hard time budget: "If you are not pushing within 30 minutes, surface a concrete blocker and exit."
5. Skip the word-count epilogue — it adds turns without adding value.
6. Encourage parallel tool calls within the agent (Read + Grep + Glob in one round).
7. If the agent reports a permission wall, the orchestrator (me) must take over the git steps — do not loop the agent on the same denial.

## Quick verification

```sh
git fetch origin
git log --oneline origin/main -1                              # 286f095
git log --oneline origin/docs/declare-supported-dialect -2    # fa231fe + 62c62a6
git ls-remote origin 'refs/heads/feat/wave4-*'                # all empty (== origin/main)
```

Resume cleanly from any of the three options above.
