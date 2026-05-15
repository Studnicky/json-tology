# Audit Pass 2 — 2026-05-15

Branch: `chore/audit-pass-2` → PR to `main`. Fail-forward only; no reverts.

Pass 1 (PR #95) covered the validation hot path, SchemaCompiler/Registry/JsonTology decomposition, the `Value`→`Operations` migration, and four direct unit-test files. Bench delta: +40-60% across validation, +69% on cold start, +70% on decode date, but two regressions (`dump nested` −9.1%, `dumpJson nested` −5.5%) and many uncovered modules.

This pass audits every module Pass 1 did not touch and remediates findings forward.

---

## Phase A — Serialization regression (root cause for `dump nested` / `dumpJson nested`)

### A.1 Add `SchemaRegistry.graphEntry()`; collapse Dumper double-lookup

**Root cause.** `Dumper.dump()` and `Dumper.resolveRef()` call `registry.get(id)` then `registry.graph(id)` sequentially. Each call re-runs `resolve()` (`curie.expand()` → `value.split(':', 2)`) and `store.get()`. For nested schemas this fires per `$ref` hop. Phase 1.1 removed the previously-co-located fallback that amortized this.

**Fix.** Add `SchemaRegistry.graphEntry(schemaId): { schema, graph } | undefined` returning the pair in a single lookup. Update `Dumper.dump()` and `Dumper.resolveRef()` to consume the pair.

**Files.** `src/modules/registry/SchemaRegistry.ts`, `src/interfaces/Registry.ts`, `src/modules/data/Dumper.ts`.

**Acceptance.** `npm run test:all` green; `dump nested` returns to baseline or better.

---

## Phase B — `GraphEngine` hot-path optimizations

### B.1 Hoist `visitContext()` closures

`GraphEngine.ts:866–909` allocates an object literal with 12 arrow closures per `visit()` call. Hoist to a single `private readonly visitContext` field built in the constructor.

### B.2 Branch on empty overrides in `execute()`

`GraphEngine.ts:255` `const effective = { ...this.options, ...overrides }` allocates per call. Branch: if `overrides` is empty/undefined, reuse `this.options`.

### B.3 Single `Object.keys` walk in `validateObject()`

`GraphEngine.ts:647, 696, 819` walk the same object three times. Hoist `const keys = Object.keys(workingValue)` once and reuse.

### B.4 `resolveRef` cache-key without template literal

`GraphEngine.ts:374–375` builds a template-literal compound key on every call. For the engine's own root (common case) look up by `ref` alone; fall back to compound key for cross-graph refs.

**Files.** `src/modules/graph/GraphEngine.ts`.

**Acceptance.** Tests green; the validate/instantiate scenarios further improve.

---

## Phase C — Materializer fixes

### C.1 Guard re-registration in `Materializer.run()`

`Materializer.ts:285` calls `this.registry.set(schema)` unconditionally. Guard: `if (!this.registry.has(schema.$id)) this.registry.set(schema)`.

### C.2 Eliminate clone-then-fill

`Materializer.ts:201–206` `structuredClone`s the value then walks the graph to fill defaults. The engine's working copy is already mutable — fill in place.

### C.3 Optional clone on `SchemaRegistry.instantiate`/`cast`/`convert`

`SchemaRegistry.ts:553, 237, 399` clone every input. Provide a no-clone fast path for trusted call sites (or detect immutable inputs).

**Files.** `src/modules/materialization/Materializer.ts`, `src/modules/registry/SchemaRegistry.ts`.

**Acceptance.** Tests green; `instantiate*`, `coerce valid`, `convert simple` improve.

---

## Phase D — `SchemaGraphSupport` allocation reduction

### D.1 Frozen-sentinel `emptySchemaGraphSemantics()`

`SchemaGraphSupport.ts:59–144` allocates a 60-field object per call. Return a single frozen singleton (callers read only).

### D.2 Empty-map sentinel in `extractSemantics()`

`SchemaGraphSupport.ts:371` allocates `new Map(graph.entries(node, 'properties'))` even when the entries array is empty. Use a frozen empty-map sentinel.

**Files.** `src/modules/graph/SchemaGraphSupport.ts`.

**Acceptance.** Tests green; `extend + validate` improves.

---

## Phase E — `FormatRegistry` hot path

### E.1 Integer-table calendar validation

`FormatRegistry.ts:340–349` `validateDateFormat` constructs `new Date(...)` and `.toISOString()` per call. Replace with integer-table day-in-month check + leap-year branch. No allocations.

### E.2 Inline type guards in validators

`FormatRegistry.ts:626–646` wraps each validator in `(v) => typeof v === 'string' && fn(v)`. Hoist the `typeof` into the validator body; store the unwrapped function. Call site becomes monomorphic.

**Files.** `src/modules/format/FormatRegistry.ts`.

**Acceptance.** Tests green; `decode date` further improves.

---

## Phase F — `Projection` allocation reduction

### F.1 Eliminate `projectSingleValue` args-spread

`Projection.ts:597–601` `{ ...args, path, value }` allocates per array element. Switch `projectSingleValue` to accept `path` and `value` as explicit params, drop the args struct.

### F.2 Fuse `canonicalPropertyIri` IRI parse

`OwlProjection.ts:45–63` calls `SchemaIri.splitSubject()` then `SchemaIri.lastSegment()` separately — two parse passes on the same IRI. Fold into a single parse.

**Files.** `src/modules/rdf/Projection.ts`, `src/modules/rdf/OwlProjection.ts`, `src/modules/graph/SchemaIri.ts` (if needed).

**Acceptance.** Tests green; ABox projection allocation drops.

---

## Phase G — `VisitComposition` lazy evaluated-sets

### G.1 Defer `evaluatedProperties` / `evaluatedItems` Sets

`GraphEngineVisit.ts:253–279` (composition path) allocates `new Set<string>()` + `new Set<number>()` per `allOf` branch even on success paths that emit nothing. Lazy-init on first member.

**Files.** `src/modules/graph/GraphEngineVisit.ts`, possibly `src/modules/graph/visit/VisitComposition.ts`.

**Acceptance.** Tests green; `intersection`, `discriminated union` improve.

---

## Phase H — Standards compliance (Pass-2 sweep)

### H.1 Move remaining inline type aliases to `src/types/`

- `src/modules/graph/RefDecoder.ts:34` `SchemaLookupType` → `src/types/SchemaLookup.ts`
- `src/modules/graph/RefDecoder.ts:42` `GraphLookupType` → `src/types/GraphLookup.ts`

### H.2 Move module-scope constants to `src/constants/`

- `src/modules/composition/Compose.ts:39` `RESTRICTIONS_KEY` → `src/constants/COMPOSITION.ts`
- `src/modules/data/Path.ts:11` `VALID_IDENTIFIER` → `src/constants/PATH.ts`
- `src/modules/format/FormatRegistry.ts:153–156` IPv6 regexes (4) → `src/constants/FORMAT_REGEXES.ts`
- `src/modules/graph/SchemaGraphSupport.ts:275` `ALLOF_EXTENSION_RE` → `src/constants/GRAPH_REGEXES.ts`
- `src/modules/ontology/GraphShaclSerializer.ts:8` `SHACL_ARRAY_KEYS` → `src/constants/SHACL.ts`
- `src/modules/rdf/OwlProjection.ts:248` `RESTRICTION_PREDICATE` → `src/constants/ONTOLOGY_PREDICATES.ts` (existing file — append)
- `src/modules/rdf/Skolemize.ts:22–27` UUID masks → `src/constants/UUID.ts` (existing — append)

### H.3 Move inline schema definitions

`src/modules/data/BaseTypes.ts:16–132` declares 9 inline schema objects (`DurationDef`, `ErrorDetailsDef`, `ProgressDef`, `TimedDef`, `TimestampedDef`, `ResponseDef`, `ResultDef`, `StateSnapshotDef`, `SortOrderDef`, `CursorDef`). These are constants — move to `src/constants/BASE_SCHEMAS.ts` (or split into per-domain files if it makes sense).

### H.4 Trim JSDoc on internals

Reduce JSDoc on private/internal methods in `GraphEngine.ts`, `SchemaIri.ts`, `SchemaGraph.ts`, `GraphEngineSupport.ts`, `RefDecoder.ts`. Keep JSDoc only where the WHY is non-obvious. Project rule: "default to writing no comments".

---

## Phase I — Test coverage gaps

### I.1 Direct unit tests for Phase-2 extracts

Add:
- `test/unit/schemaEntryStore.test.ts` — covering set/get/delete/has/clear/forEach, hash index, duplicate detection, revision counter
- `test/unit/schemaRefWalker.test.ts` — covering collectEmbeddedIds, collectRefs, assertResolvable, collectUnresolved
- `test/unit/refResolutionLoader.test.ts` — covering loader walking, missing-ref behavior, snapshot integration
- `test/unit/schemaCompilerPlan.test.ts` — covering buildNodePlan output for representative node kinds

Each ≥8 behavioral assertions.

---

## Phase J — Documentation drift

### J.1 Update `docs/value/clone-hash.md`

Replace `Value.clone()` references with `Operations.clone()`. Replace `Value.hash()` with `Hash.value()`. Verify all example snippets compile against current API.

### J.2 Update `docs/value/diff.md`

Replace `Value.applyOp()` references with `Operations.patch()`. Rename section headers as needed.

---

## Phase K — Wrap-up

### K.1 CHANGELOG `[Unreleased]` extension

Add Performance, Internal, Docs sections summarizing Pass-2 work.

### K.2 PR to main

Run `npm run test:all`, `npm run type-check`, `npm run lint`, `npm run bench:report`. Open PR; wait for green CI; squash-merge.

---

## Execution order

1. **Wave 1 (parallel, disjoint files):** A, B, D, E, F
2. **Wave 2:** C (touches files A modifies)
3. **Wave 3:** G (depends on B)
4. **Wave 4 (parallel):** H, I, J
5. **Wave 5:** K (bench + PR)

Acceptance per phase: tests + type-check + lint green. No `--no-verify`, no skipped hooks. Each phase ends with one conventional commit.
