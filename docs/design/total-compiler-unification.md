# Total Compiler Unification — One Execution Path

Status: SHIPPED on `feature/compiler-single-path` (Waves 0–5 complete). Validation
runs a single compiled path; the graph interpreter executor is deleted. See
"Remaining work" at the end for what is intentionally left.
Branch: `feature/compiler-single-path`
Issue: #159 (regression undone to ~v0.22; the pre-v0.16 gap remains — see Remaining work).

## Goal

Collapse the two validation executors into one. Today validation runs the
**compiled** executor (`SchemaCompiler` → closure plan) and falls back to the
**graph interpreter** (`GraphEngineVisit.visit`) whenever it meets a node it
cannot compile. The interpreter is a second, independent implementation of the
same validation semantics — a drift hazard, and the fallback runs the whole
schema on the path that is ~4.5× slower.

End state:

- The compiled plan is the **only** runtime executor.
- The plan is a lossless **execution projection of the canonical graph**, keyed
  by graph node IRI — the executable peer of `OwlProjection`/`ShaclProjection`,
  not an escape from the graph.
- `GraphEngine` keeps its role as graph builder + semantics cache (compile-time
  input). `GraphEngineVisit` is **deleted as a runtime executor**.
- No `supportsCompilationPath` gate, no `RangeError` fallback, no `compiled:false`.

## Root causes being removed (from the enumeration spike)

| # | Root cause | Site | Class |
|---|-----------|------|-------|
| 1 | Cyclic schema → `RangeError` runtime fallback + eager property descent | `SchemaCompiler.ts:1065-1078`, `SchemaCompilerPlan.ts:1454-1469` | structural |
| 2 | `$dynamicRef`/`$dynamicAnchor` reject | `SchemaCompilerPlan.ts:1211-1212` | state-threading |
| 3 | `unevaluatedProperties`/`unevaluatedItems` reject | `SchemaCompilerPlan.ts:1213-1214` | state-threading |
| 4 | `rdfsRange`/`rdfsDomain` reject | `SchemaCompilerPlan.ts:1215` | lowering |
| 5 | `$ref` unresolvable → silent skip (constraint not enforced) | `SchemaCompilerPlan.ts:1107-1110, 1483-1486` | correctness bug |
| 6 | compile-time `try/catch` → `engineFallback` on any throw | `SchemaCompiler.ts:1054-1088` | symptom of 1–4 |

The ~10 composition/structural rejections and ~16 flat-object fast-path bail-outs
are derivative: composition rejections fire only because a descendant hits 2–4,
and the flat-object items are optimization barriers (fall through to full
compilation, never to the interpreter). They resolve for free once 1–6 are fixed.

## The keystone: a unified execution-step contract

Both executors must speak one signature. The compiled step currently has no
vehicle for `refStack`, `dynamicScope`, `evaluated*`, or `depth`; the interpreter
threads all of them. Introduce one context bag and one step type.

### New: `src/types/ExecContext.ts`

```ts
export type ExecContextType = {
  'errors': ValidationErrorType[];
  'collectErrors': boolean;
  'applyDefaults': boolean;
  'doCoerce': boolean;
  'stripUnknown': boolean;
  'refStack': Set<string>;                       // schema-recursion guard (cyclic schema + cyclic data)
  'dynamicScope': DynamicScopeEntryType[];       // $dynamicAnchor stack
  'evaluatedItems': Set<number> | undefined;     // accumulated by array/contains/composition
  'evaluatedProperties': Set<string> | undefined;// accumulated by props/pattern/additional/composition
  'depth': number;
  'maxDepth': number;
};
```

### Evolve: `ValidateWithErrorsFnType` → the single step

```ts
// src/types/Validation.ts
export type ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  ctx: ExecContextType
) => ValidateWithErrorsResultType;   // { valid, value } — evaluated sets live on ctx
```

This replaces the 7-positional-flag signature. The flags (`collectErrors`,
`applyDefaults`, `doCoerce`, `stripUnknown`) and `errors` move onto `ctx`. The
evaluated sets are mutated on `ctx` (matching how `visit` threads them), so the
step return stays `{ valid, value }`.

**Composition scoping constraint (do not get this wrong):** `anyOf`/`oneOf`/`if`
branches must not leak `evaluated*` contributions from branches that do not
apply. The interpreter scopes this via the per-branch `acc` object and result
merging (`GraphEngineVisit.ts:281-398`, `VisitComposition.ts`). The compiled
executor must replicate: a branch contributes evaluated keys/items to the parent
`ctx` only when it is the applicable/passing branch, per 2020-12 semantics.
Snapshot-and-restore or child-set-and-merge — implementer's choice, but the
existing `VisitComposition` behavior is the oracle the conformance tests pin.

## The plan graph: IRI-keyed, two-pass, cycle-safe

`compileRefValidator` (`SchemaCompilerPlan.ts:1474-1512`) inlines/descends into
ref targets eagerly; a recursive `$ref` either non-terminates at compile time or
stack-overflows at run time. Replace eager descent with a two-pass build over an
IRI-keyed plan map.

- **Pass 1 (allocate):** walk graph nodes, allocate one plan entry per node IRI
  into `Map<string, CompiledNodeValidationPlanType>`. No descent into children.
- **Pass 2 (link):** populate each plan's child validators; `refValidator`
  becomes a **lookup** into the plan map by target IRI (a back-edge), never an
  inline expansion. A recursive schema is a finite cyclic plan graph.
- **Runtime cyclic-data guard:** the single executor consults `ctx.refStack`
  exactly as the interpreter does (`Refs.ts:54-96`): build a `refKey`
  (`${schemaId}::${ref}`), short-circuit `valid:true` if present, add before
  descent, delete in `finally`. This moves cyclic-data protection into the one
  executor — no `RangeError` catch needed.

The scaffolding already half-exists: `compilingNodes` (`SchemaCompiler.ts:1192`)
and the `visited` set in `nodeSupportsCompilation` (`SchemaCompilerPlan.ts:1281`).
Generalize that pattern into the plan-map build; do not invent a new one.

## Waves

The compiler core (`SchemaCompiler.ts`, `SchemaCompilerPlan.ts`,
`exec/{Scalars,Objects,Arrays,Composition}.ts`) is one tightly-coupled
compilation unit. Per WELC, the shared core is **sequential, single-agent** per
wave; parallel edits to these files corrupt each other's typecheck. The only
safely-parallel stream is test authoring against frozen contracts.

### Wave 0 — Foundation (sequential, single agent) ✦ keystone

Owns: `src/types/ExecContext.ts` (new), `src/types/Validation.ts`,
`src/modules/validation/SchemaCompiler.ts`,
`src/modules/validation/SchemaCompilerPlan.ts`,
`src/modules/validation/exec/{Scalars,Objects,Arrays,Composition}.ts`.

1. Add `ExecContextType`. Evolve `ValidateWithErrorsFnType` to `(value, path, ctx)`.
2. Thread `ctx` through every compiled step + every `exec/*` module. Move the
   four flags and `errors` onto `ctx`. Evaluated sets mutate on `ctx`.
3. Convert plan build to two-pass IRI-keyed plan map; `refValidator` → map lookup.
4. Add `ctx.refStack` guard in the executor; **delete** the `RangeError`
   try/catch fallback (`SchemaCompiler.ts:1065-1078`).
5. Fix root #5: unresolvable `$ref` emits a `REF_UNRESOLVED` validation error
   (or `GraphError` at compile time per existing convention), never silent skip.

Acceptance: `npm run build`, `npm run type-check`, `npm run test:all` green.
Existing `compiled:false` fallback path may still exist for genuinely-unsupported
nodes at this wave (2–4 not yet lifted) — that is the only sanctioned interim
fallback, removed in Wave 4.

### Wave 1 — Dynamic scope (sequential, single agent)

Owns: `SchemaCompilerPlan.ts`, `SchemaCompiler.ts`, `exec/*` as needed.
- Compile `$dynamicAnchor`: push `{anchor, graph, node}` onto `ctx.dynamicScope`
  (immutable spread, per `GraphEngineVisit.ts:100-109`).
- Compile `$dynamicRef`: resolve against `ctx.dynamicScope` end-to-start, port
  `GraphEngine.resolveDynamicRef` logic (`GraphEngine.ts:474-509`).
- Remove `$dynamicRef`/`$dynamicAnchor` from `hasUnsupportedKeywords`.

Acceptance: 2020-12 `$dynamicRef` conformance cases compile (no fallback); full suite green.

### Wave 2 — Unevaluated + rdfs (sequential, single agent)

Owns: `SchemaCompilerPlan.ts`, `exec/{Objects,Arrays}.ts`, plus an rdfs lowering site.
- Thread evaluated-set accumulation through compiled composition (already partly
  computed in `exec/Objects.ts`/`Arrays.ts` — stop discarding it).
- Compile `unevaluatedProperties`/`unevaluatedItems` as a post-pass over residual
  keys/indices using `ctx.evaluated*` (oracle: `Unevaluated.ts`, `GraphEngineVisit.ts:404-449`).
- Lower `rdfsRange`/`rdfsDomain` to plan constraints.
- Remove those four keywords from `hasUnsupportedKeywords`; the function should
  now reject nothing structural.

Acceptance: `unevaluated*` + rdfs conformance cases compile; full suite green.

### Wave 3 — Custom keywords + totality audit (sequential, single agent)

Owns: `SchemaCompiler.ts`, `SchemaCompilerPlan.ts`.
- Confirm every active custom keyword (`extensions`, `SchemaCompilerPlan.ts:450`)
  compiles to a plan step; if any genuinely cannot, that is the ONE documented
  residual fallback — surface it explicitly, do not paper over.
- `supportsCompilationPath` must now return `true` for every node the test corpus
  exercises. Assert this with a corpus sweep test.

### Wave 4 — Swap + delete interpreter

Audit (DONE): with `engineFallback` forced to throw, the full runtime suite (3108
tests) passes and the fallback is hit 0 times; full bookstore (56 schemas) +
conformance corpus compile with 0 fallback. The validation interpreter is dead.

- **4a (DONE).** Removed `engineFallback`, the `supportsCompilationPath` gate, and
  the compile-time try/catch from the validate path. Uncompilable schemas now
  surface the precise error (e.g. `REF_NOT_FOUND`) instead of silently degrading.
  `GraphEngineVisit`/`GraphEngine.execute` no longer reachable from validation.
- **4b (DONE).** `synthesizeDefaults` (data-aware zero-value synthesis) and
  `ignoreAdditionalProperties` are compiled into the plan; `Materializer.run` runs
  on the compiled validator and no longer calls `engine.execute`. `GraphEngineVisit`
  and `visit/{Refs,Unevaluated,VisitComposition}` are deleted. `GraphEngine.execute`/
  `check`/`errors` and `GraphExecutionResultType` are removed entirely (a later
  cleanup pass deleted the throwing stubs). `GraphEngine` retains graph construction
  + `semantics()`.

### Parallel stream — Conformance harness (independent agent, Wave 0–2)

Owns: `test/` files only (no `src/`). Build/extend a corpus test that runs the
JSON Schema 2020-12 suite + repo fixtures through `registry.validate` and asserts
(a) correctness and (b) `compiled === true` (no fallback) per case. This is the
oracle every wave is graded against. May start immediately against the frozen
contracts in this spec.

## Wave 5 — Eliminate `CheckFnType` (one routine per feature)

`ValidateWithErrorsFnType` is the single compiled representation of every node.
`CheckFnType` and the parallel `compile*Check` tree are removed. `check()` runs the
validate routine in check-mode (`collectErrors:false`); every internal boolean test
(`anyOf`/`oneOf` members, `not`, `if`, `contains`) runs a member validator in an
isolated check-mode scratch ctx (no error/value/evaluated leak to the parent).

All sub-steps DONE:
1. `check()` is `buildCheckFromValidate` (validate routine in check-mode).
2. `anyOf`/`oneOf` use one routine per operator. The three former strategies
   (`validate*` checks / `*WithValues` / `*WithEvaluated`) and the base-vs-wrap
   duplication are collapsed: each member runs in an isolated check-mode scratch
   ctx, the winning branch produces value, evaluated merges under `ctx.trackEvaluated`,
   and composition is evaluated exactly once per node (`oneOf` "exactly one" preserved —
   pinned by `test/types/round-trip.test.ts`).
3. `not`/`if`/`contains` run member validators in check-mode against the reusable
   scratch ctx; `complementCheck`/`ifCheck`/`containsCheck` plan fields are gone.
4. The entire `compileNodeCheck` tree (both files) is deleted — proven dead via a
   probe (compileNodeCheck forced to throw → full runtime suite green, 0 hits).
5. `CheckFnType`/`OptionalCheckFnType` removed from the plan IR and `src/types`;
   15 orphaned check-only type files deleted. `grep CheckFnType src/` = 0.

## Invariants (every wave)

- ⊥ No `as` casts, `@ts-ignore`, `eslint-disable`, or `void` placeholders to reach green.
- ⊥ No weakening of tests/fixtures to pass.
- The graph remains the single semantic source; the plan is its projection, keyed
  by node IRI. No second semantic model is introduced.
- After each wave: `npm run build && npm run type-check && npm run test:all` green
  before the next wave dispatches. Wave 4 additionally gated by `litany ci` + bench.
- `removeAdditionalProperties`/`enforceSchemaProperties`/`applyDefaults`/`castTypes`
  behavior (the `CompiledValidateOptionsType` surface) is preserved exactly.

## Risk

Highest in Wave 0 (signature change ripples through every `exec/*` site) and the
composition evaluated-set scoping. Both are pinned by the conformance harness.
Wave 4 is the irreversible swap — it dispatches only after Waves 0–3 are green and
the harness reports zero fallbacks.

## Remaining work

The single-path architecture is shipped; these are the open items, ordered by value.

### 1. Performance — close the pre-v0.16 gap (issue #159 not fully closed)
The branch undid the regression it introduced and sits at ~77–90% of the v0.22
baseline (review-valid ~520–620k vs 677k; order/nested ~235–255k vs 269k; ajv
control stable). The deeper gap to pre-v0.16 (~884k review-valid) is **not**
allocations (V8 escape analysis already neutralizes short-lived objects) — it is
the executor's call-tree depth and per-node/per-layer `{earlyExit,valid,value}`
result objects (`runPlanStructureAndTail → runPlanRefAndScalars → validatePlanScalars
→ validateObjectPlan → validateObjectFields → validateProperties`). Closing it means
flattening that chain / switching the leaf protocol to sentinel returns + ctx-carried
value. Large, hot-path, profile-guided; gate on the validate bench. This is the right
lever to reopen #159 with.

### 2. Release artifacts (before merge)
- `CHANGELOG.md` `[Unreleased]` entry for the single-path unification (added with this doc).
- PR against `main` (repo is main-only) after `/enginseer:review-self`.

### 3. Dead exports (DONE)
A native unused-export sweep (knip not installed; per the no-unnecessary-deps rule we
did not add it) found ~50 exports with zero references outside their defining file, then
classified them: barrel-re-exported (public API) vs not. Outcome:
- **16 genuinely-dead removed** — `EMPTY_*` (EXECUTION_OPTIONS), `URI_SCHEME_PATTERN`,
  `IP_VERSION_4/6`, `DAYS_IN_FEB_LEAP`, `RESTRICTION_PREDICATE`, `CARDINALITY_KINDS`,
  `ID_/REF_/DEFS_/SCHEMA_KEYWORD`, `XSD_COERCERS`, `PlanCompileOptionsType`, `VariantEntryType`
  (file deleted). Stale doc cross-refs and a now-unused import cleaned.
- **9 kept (same-file usage)** — `VOCABULARY_*` feed `SUPPORTED_VOCABULARIES`;
  `RestrictionResultType`/`RelationsContextType` are same-file base types. Not dead.
- **25 kept (public API)** — re-exported by a barrel/entry, e.g. `SchemaLoadErrorType`
  (documented in CLAUDE.md as the canonical loader-failure type).

### 4. Done as part of this work (no action)
- Empty `src/modules/graph/visit/` directory removed.
- `GraphEngine.execute/check/errors`, `GraphExecutionResultType`, `EXEC_NOT_SUPPORTED`,
  and stale `engine.execute` docs deleted.
- Interpreter-orphaned type files removed: `VisitFn.ts`, `VisitContext.ts`,
  `InternalExecutionResult.ts` (the deleted `GraphEngineVisit` was their only consumer).
- `crossEngineMessageParity` message-content assertions restored (keyword + exact
  message sourced from `VALIDATION_MESSAGES`); renamed → `compiledMessageValidation.test.ts`.
  `compiledInterpretedParity.test.ts` → `compiledVerdict.test.ts`.
- `src/cli.ts` casts removed: `buildGraphOutput` narrows the root schema and skips
  schemas without a string `$id`; the schema-file loader wraps `JSON.parse` and reports
  malformed/non-object input via `SchemaError(INVALID_INPUT)` instead of bare throws/casts.
