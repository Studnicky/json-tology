# Total Compiler Unification — One Execution Path

Status: implementation spec (issue #159 superset)
Branch: `feature/compiler-single-path`

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
- **4b (BLOCKED — prerequisite).** `GraphEngine.execute` is still used by
  `Materializer.run` (`Materializer.ts:471`) for `synthesizeDefaults` /
  `createDefault()` — an interpreter-only capability with no compiled equivalent.
  Deleting `GraphEngineVisit` requires first compiling zero-value synthesis
  (`synthesizeDefaults`) into the plan, then re-pointing `Materializer` at it.
  `GraphEngine` retains graph construction + `semantics()` regardless.

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

Order (each sub-step gated by test:all + conformance + bench-no-material-regression;
revert any keyword whose unification regresses materially):
1. `check()` → `buildCheckFromValidate` (DONE — API-level one-way; green).
2. `anyOf`/`oneOf` (BLOCKED — reverted). Naively routing the base executor through the
   validator form double-validates oneOf: composition is already evaluated in TWO layers
   — `executeComposedAnyOneNot` (base) AND `wrapWithValueProducingComposition` →
   `validateOneOfWithValues` (value path). "exactly one" breaks, with no perf gain
   (bench flat). PREREQUISITE: consolidate the three composition strategies
   (`validate*` checks / `*WithValues` / `*WithEvaluated`) into ONE routine that produces
   value + merges evaluated under `ctx.trackEvaluated`, removing the base-vs-wrap
   duplication. Only then can `anyOfChecks`/`oneOfChecks` be dropped.
3. `not`/`if`/`contains`: replace `complementCheck`/`ifCheck`/`containsCheck` with
   validator-in-check-mode against a reusable scratch ctx (no side-effect leak).
4. Delete the now-dead top-level check tree (`compileNodeCheck`, `compileNode*Check`,
   `compileArrayCheck`/`compileObjectCheck`/`compileRefCheck`, `buildAnyOfCheck`/
   `buildOneOfCheck`, check dispatcher contexts) across both files.
5. Remove `CheckFnType` from the plan IR and `src/types`.

Note: `compileCheck` (the top-level entry) is already deleted; `compileNodeCheck` and
its tree remain reachable only through the composition `*Checks` and ref/if/contains
sub-validators, so the dead-tree deletion (step 4) is gated on steps 2–3.

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
