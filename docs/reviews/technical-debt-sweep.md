# Technical-Debt Sweep — Remaining Work

The 2026-06 repo-wide technical-debt sweep (type safety, pattern coherence,
logging coverage, duplication, layering, naming) landed across six waves; see
git history for the full remediation record. One item from that sweep remains
open.

## Open: `src/types/` filename-per-symbol alignment

OQ2 resolved that every concrete data-shape `type` alias ends `*Type`; that
half is lint-enforced (`type-alias-must-end-type` in `eslint-rules/noocodec.mjs`).
The second half — each file named for the single symbol it exports, mirroring
the rule already enforced for `src/interfaces/` (`filename-matches-export`) —
is not yet applied or lint-enforced for `src/types/`.

Current state: 179 of 219 files under `src/types/` end in `Type.ts`; 40 do
not. Independent of naming, 38 files export more than one `type` from a
single file (e.g. `Compiler.ts`, `GraphEngine.ts`, `Registry.ts`,
`Compose.ts`, `Infer.ts`) and would need splitting, or an explicit allowlist
predicate distinguishing a file's primary concrete type from generic/mapped
helper types that may legitimately share its file, before a
`filename-matches-export` rule could apply to `src/types/**` the way it
already does to `src/interfaces/**`.
