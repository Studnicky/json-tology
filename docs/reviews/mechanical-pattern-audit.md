# Mechanical-Pattern Audit & Remediation Plan

Repo-wide audit of json-tology (≈55K LOC, 6 module groups) across five concerns:
error propagation, logging consistency, error-code discipline, layering, and
single-definition / duplication. This document is the work plan; each wave is
executed on `feature/mechanical-pattern-hardening` with a full
typecheck + lint + test + build gate at every wave boundary.

## Status: all five waves complete, verified

Branch `feature/mechanical-pattern-hardening`, 68 files changed (+825/-491).
Full gate green: `type-check:all` (main + examples + type-tests + declarations),
`eslint .`, production `build`, unit (2734), integration (530), e2e (155) — 3419
tests, 0 failures. Invariants enforced tree-wide: 0 inline error-code literals,
0 bare `throw new Error`, 0 live `console.*`. `Predicates` relocated to `data/`
and `Dumper` to `graph/` (git-tracked renames).

## Baseline (pre-remediation, verified green)

- `tsc --noEmit` — clean
- `eslint .` — clean
- smoke + unit tests — green
- Zero bare `throw new Error(` anywhere in `src/` (typed-error discipline intact)
- Serializer delegation is thin; `JsonLdFormatter` called only from `OntologyBuilder`
- No live `console.*` (all 11 matches are JSDoc examples)
- No internal barrel imports in most scopes

## The five patterns to codify

### ⊥ Pattern 1 — Error propagation: never swallow, never fabricate a pass

Every failure path either throws a typed `BaseError` subclass, or is handled at
the next layer with an explicit strategy (retry / fallback / alternate routing /
failure emission). A `catch` returning `null/[]/{}/false/''`, or a lookup-miss
fabricating a valid result, is forbidden. Semantic catches (validity predicates,
optional peer-deps) must discriminate the expected error and rethrow the rest.

Canonical reference: `rdf/ProjectionHelpers.ts:71` — catches only
`GraphError` with `POINTER_NOT_FOUND`, rethrows everything else.

Critical (output corruption / silent wrong-answer):
- `rdf/ShaclProjection.ts:559–608` — `emitRestrictionPropertyShape` orphans 2 quads on 4 `return undefined` paths
- `rdf/ShaclProjection.ts:328–349` — `complementBnode` pushed but never wired into return chain (dead subtree in output)
- `rdf/OwlProjection.ts:554` — empty `onProperty=''` emitted as invalid IRI
- `validation/SchemaCompiler.ts:649–656` — `graph.node===undefined` returns a pass-everything validator
- `validation/SchemaCompilerDefaults.ts:24–31` — unresolved `$ref` in default silently resolves to `rootNode`
- `validation/SchemaCompilerDefaults.ts:15–22` — `resolveDynamicRef` discards its arg, always returns `rootNode`
- `validation/SchemaCompilerPlan.ts:704–711` — unresolvable `$dynamicRef` silently passes

Swallow sites (discriminate-or-throw):
- `ontology/OwlImporter.ts:380` — `JSON.parse` fail → `return []` (document vanishes)
- `ontology/importDispatch/ClassAxioms.ts:73–77` — union-literal parse fail → axiom dropped, not even reported
- `ontology/OwlImporter.ts:250–252` — redundant outer `catch {}`
- `ontology/OwlImporter.ts:297–304, 351` — unexpected JSON-LD shape → `return []`
- `validation/ShaclValidator.ts:526–531` — invalid regex → `matches=true` (constraint skipped, no emission)
- `validation/exec/Scalars.ts:128` — format-validator throw → `passed=false`, exception lost
- `rdf/Lift.ts:194–202` — swallows all errors from `resolvePointer` (must discriminate `POINTER_NOT_FOUND`)
- `registry/InvariantStore.ts:60` — user `invariant.fn(value)` called with no try/catch
- `graph/RefResolutionLoader.ts:44–49` — loaded schema with non-string `$id` silently discarded
- `graph/SchemaGraphRelations.ts:473–487, 229–232` — domain / restriction relation dropped on map-miss
- `format/FormatRegistry.ts:202–207` — `domainToAscii` returns `''` on failure (contract conflation)
- `loaders/Loaders.ts:112` — 4xx/5xx → `null`, discarding HTTP status; `SchemaLoadErrorType` unused

Correct as-is (keep): `FormatRegistry.ts:111,124,712` boolean validity predicates.

### ⊨ Pattern 2 — Logging: one threading mechanism, structured context, or silence by design

A subsystem that can fail or skip work accepts `logger?: LoggerInterface` in its
options bag, defaults to `SILENT_LOGGER`, and emits `{ component, operation }`
context (`component` = class/module, `operation` = method, `component ≠ operation`)
at notable branches. Pure-computation modules may stay silent — by decision.

Context-threading mechanism — DECISION: `LoggerInterface` stays string-first
(`(msg: string, ...args: unknown[])`). Mirroring Pino's object-first `LogFn`
overload was rejected: it makes a trivial consumer-supplied `warn: (msg) => void`
fail to typecheck (breaks the `78`/`79` advanced examples) for an optional,
silent-by-default logger — a worse regression than the latent incompatibility.
A real Pino instance is already assignable to the string-first signature. The
`component + operation` requirement is satisfied by a uniform, greppable message
convention `[Component.operation] message`, applied at every call site. This works
with any logger and needs no interface change.

Implemented: canonical `logScope(component, operation, message)` helper
(`src/modules/data/LogScope.ts`); the 5 existing `SchemaRegistry` calls migrated
to the convention; optional `logger?: LoggerInterface` DI (default `SILENT_LOGGER`)
threaded into `SchemaCompiler`, `Materializer`, `OwlImporter`, `OntologyBuilder`,
and `OwlImportContextType`, wired end-to-end from `JsonTology` → registry →
compiler/materializer and from `JsonTology` → importer/builder. Branch points
(compile-time throws, materialization failures, `reportUnsupported` drops) emit
via `logScope`.

Consciously scoped OUT (reported, not silently deferred): deep logger DI into the
graph-layer classes (`SchemaGraph`, `GraphArtifact`, `RefDecoder`). Those are
constructed in many sites; their failures now throw typed `GraphError`s that
surface to callers (compiler/materializer/registry) which DO log. Adding logger DI
there is high-churn for observability-only value and is a candidate follow-up, not
a correctness gap.

### § Pattern 3 — Error codes: named constants only

Every throw references a `*ErrorCode.*` constant from `constants/ERROR_CODES.ts`.
Current state: 77 inline literals vs 19 constant uses. Worst: `SchemaRegistry.ts`
(23+), `JsonTology.ts` (11), `graph/GraphArtifact.ts` (6), `materialization/Materializer.ts` (5).

Latent trap: `SchemaErrorCode.DIALECT_UNSUPPORTED` → `'SCHEMA_DIALECT_UNSUPPORTED'`
but `GraphErrorCode.DIALECT_UNSUPPORTED` → `'DIALECT_UNSUPPORTED'` (same key,
divergent value). Disambiguate. Also relocate `RESTRICTION_PREDICATE_MAP`
(`graph/SchemaGraphRelations.ts:210`) to `constants/ONTOLOGY_PREDICATES.ts`.

### ⬡ Pattern 4 — Layering: graph-native, shared substrate flows downward only

`graph/` is canonical; validation/materialization/ontology/rdf consume it; shared
primitives in `data/` flow down. No module reaches up a layer.

- `graph/GraphEngineScalars.ts:4` imports `validation/Predicates` (inversion) → relocate `Predicates` to a shared layer
- `data/Dumper.ts` imports `SchemaIri`/`GraphError`/`Transform` (misplaced) → move out of `data/`
- `validation/ShaclValidator.ts` builds a second semantic model from raw quads (isolated; flag against growth)

### ≡ Pattern 5 — Single definition: no duplicated helpers, no inline types, no phantom homes

- `ontology/importDispatch/` — `targetValue` ×4, `emptyFragment` ×3, `decodeListItemLiteral` ×2, `relationsByPredicate` ×2 → new `importDispatch/DispatchHelpers.ts`
- `data/` siblings reimplement `isRecord` inline: `Hash.ts:32`, `StructuralHash.ts:17`, `Frozen.ts:6`
- `rdf/` — `isRdfFirst/Rest/Nil` dup in `Lists.ts:26` & `JsonLdFormatter.ts:19`; `XSD_IRI_PREFIX` dup in `ShaclProjection.ts:45` & `Terms.ts:54`
- `validation/SchemaCompiler.ts` — 14-field `ExecContextType` assembled inline 5× → `buildExecContext()` factory
- `types/OwlImport.ts:108` — `DispatcherFnInterface` (a function type) → rename `DispatcherFnType`
- `types/OwlImport.ts:58` — `PrefixMap` → `PrefixMapType`
- `validation/ShaclValidator.ts:37–408` — 8 inline type aliases → extract to `types/Shacl.ts`
- `ontology/Datatypes.ts:231` — inline anonymous param-bag type → extract
- `SchemaRegistry.ts:170` — inline anon type duplicating `RefDecoderRegistryType`
- Phantom re-export homes: `RefDecoder.ts:15`, `SchemaRegistry.ts:88`, `QuadFactory.ts:32`

Out of scope (functional gaps, need explicit authorization before implementing):
- `viz/TypeStringEmitter.ts:52` — shipped stub returning `Record<string, unknown>` for every schema
- `ontology/importDispatch/Individuals.ts:127,150,171` — invariants whose `fn` always returns `null`

## Wave plan (file ownership disjoint within each wave; full gate at boundaries)

1. **Foundations** — Logger interface signature; error-code literal → constant migration; `DIALECT_UNSUPPORTED` disambiguation; `RESTRICTION_PREDICATE_MAP` relocation.
2. **Critical error paths** — the 7 output-corruption / silent-pass sites, each with a regression test.
3. **Swallow-site sweep** — discriminate-or-throw across the medium swallow sites.
4. **Logger threading** — DI into entry classes with silent branches; migrate the 5 `SchemaRegistry` calls to structured form; emit at branches surfaced in waves 2–3.
5. **Layering + dedup** — relocate `Predicates` and `Dumper`; `DispatchHelpers.ts`; collapse `isRecord`/`isRdf*`/`XSD_IRI_PREFIX` duplicates; extract `ShaclValidator` types; `buildExecContext` factory; rename `DispatcherFnType`/`PrefixMapType`; remove phantom re-exports.

## Enforcement (after remediation)

Where a pattern can be mechanically enforced, add a `litany` / ESLint rule so the
pattern is a gate, not a convention: no-inline-error-code-literal, logger-DI
presence on failable classes, and the existing `interface-must-be-contract` /
type-location rules already cover the type/interface split.
