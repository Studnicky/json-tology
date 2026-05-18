# Audit Pass 4 — 2026-05-15

Branch: `chore/audit-pass-4` → PR to `main`. Fail-forward only.

Pass-3 fixed the bench measurement artifact. Pass-4 applies the same "build once, reuse many" pattern to production code: hot-path callers that allocate fresh state per call when the result is invariant.

## Phase A — `SchemaCompilerPlan` allocation reduction

`src/modules/validation/SchemaCompilerPlan.ts` (964 LOC) compiles per-node validation plans. Allocations found:

**A.1** `compileObjectCheck:264` and `buildNodePlan` (~line 901) both allocate `new Set(sem.required)` / `new Set(sem.properties.keys())` per compile-node. Cache on the compiled plan or hoist to a shared helper that returns the Set once per `sem`.

**A.2** `nodeSupportsCompilation:493–501` spreads `[...sem.allOf, ...sem.anyOf, ...sem.oneOf]` into a temporary array for iteration. Replace with three sequential `for` loops.

**A.3** Boolean validators at lines 131, 403–409, 601–618 allocate fresh `() => true` / `() => false` closures per compile call. Hoist module-scope singletons `ALWAYS_TRUE_CHECK`, `ALWAYS_FALSE_CHECK`, `TRUE_VALIDATOR`, `FALSE_VALIDATOR`.

**A.4** `nodeSupportsCompilation:459` allocates `new SchemaGraph(refSchema)` when `lookupGraph` misses. Ensure `lookupGraph` is threaded from registry callers; ephemeral graph construction inside compilation is the symptom.

**File.** `src/modules/validation/SchemaCompilerPlan.ts` only.

**Acceptance.** Tests pass; lint/type-check clean; one commit.

---

## Phase B — `GraphEngine` hot-path access patterns

**B.1** `validateObject:682–683` does `propertyNodeMap.has(key)` then `propertyNodeMap.get(key)` — two Map lookups for one result. Replace with single `.get()` + `undefined` check.

**B.2** `validateArray:450` uniqueItems uses `workingValue.slice(index + 1).some(...)` — allocates a new array slice per element. Replace with index-based loop scanning from `index + 1` to end without slicing.

**B.3** `validateObject:569–571` aliases `sem.properties` to two local names. Use one local consistently.

**B.4** `defaultResolutionContext` allocates a fresh object with two arrow closures per call. Hoist to constructor-built `private readonly cachedDefaultResolutionContext` field (same pattern as `cachedVisitContext` from Pass-2 B.1).

**B.5** `SchemaGraphSupport.escapeJsonPointerSegment` is called via `SchemaGraphSupport.escapeJsonPointerSegment(...)` inside per-property loops at lines ~93, 97, 144, 148. Hoist a local alias `const escape = SchemaGraphSupport.escapeJsonPointerSegment` at function entry or as a module-scope import alias.

**File.** `src/modules/graph/GraphEngine.ts` only.

**Acceptance.** Tests pass; lint/type-check clean; one commit.

---

## Phase C — `SchemaRegistry` hot-path fixes

**C.1** `engine()` (lines ~438–450) builds `engineOptions` via a triple object spread and embeds two inline arrow closures (`lookupGraph`, `lookupSchema`). Hoist the closures to `private readonly` fields built in the registry constructor; build the options object via direct field assignment (no spreads).

**C.2** `engine()` calls `GraphEngineSupport.buildEmbeddedSchemaMap(entry.schema)` unconditionally. For schemas with no embedded `$id`, this walks the whole tree and allocates an empty Map. Guard: short-circuit to a frozen empty-map sentinel when the schema has no nested `$id` (detect via a cheap walk or store a flag at registration).

**C.3** `instantiate` (~line 547) calls `this.computedStore.getMap(schemaId)` which builds a plain object via `Object.fromEntries(entry)`, then `Object.keys({})` returns `[]` — allocations even when there are no computed fields. Add `hasComputedFields: boolean` flag on `SchemaRegistryEntryInterface`; skip the path when false.

**C.4** `Curie.expand` (in `src/modules/registry/Curie.ts` or wherever it lives) splits the string on `:` per call. `SchemaRegistry.resolve` calls `expand` on every public method. Memoize `expand(input) → output` in a `Map<string, string>` on the `Curie` instance.

**Files.**
- `src/modules/registry/SchemaRegistry.ts`
- `src/modules/registry/Curie.ts` (or wherever Curie lives)
- `src/interfaces/Registry.ts` for `hasComputedFields` field on the entry interface

**Acceptance.** Tests pass; lint/type-check clean; one commit.

---

## Phase D — Materializer + JsonTology fixed singletons

**D.1** `Materializer.run` (~lines 290–298) builds a fresh 6-field overrides object per call. Cache as a `private readonly` instance field; build once in the constructor from `this.options` + registry flags. Two variants (with/without `synthesizeDefaults`) can be precomputed.

**D.2** `JsonTology.toSchema:1162` creates `new GraphSchemaSerializer()` per call. `GraphSchemaSerializer` is stateless (matches the `ontologySerializer` / `shaclSerializer` instance-field pattern). Either hoist to a module-scope singleton or store as an instance field on `JsonTology`.

**Files.**
- `src/modules/materialization/Materializer.ts`
- `src/JsonTology.ts`

**Acceptance.** Tests pass; lint/type-check clean; one commit.

---

## Phase E — RefDecoder + GraphEngineDefaults + relations

**E.1** `RefDecoder.walkAdditionalProperties:82` allocates `new Set(semantics.properties.keys())` per call. `semantics.properties` is already a Map — call `.has(key)` directly on it instead of materializing a Set.

**E.2** `GraphEngineDefaults.createImplicitDefaultValue:21` and `synthesizeZeroValue:96` declare `visited = new Set<string>()` as a default parameter. Every external caller allocates a fresh Set. Make `visited` internal-only; expose public wrappers that own the single allocation.

**E.3** `SchemaGraphRelations.pushDependentRequiredRelations:115–119` does `Object.entries(...).filter(...)` per node. Iterate directly with a length guard in the loop body — no intermediate arrays.

**E.4** `SchemaGraphRelations.pushPropertyTypeRelations:289` and `pushUnionTypeRelations:314` each call `.filter()` on the same `schemaTypes` array. Compute `nonNullTypes` once in `extractRelations`; share between both call sites.

**Files.**
- `src/modules/graph/RefDecoder.ts`
- `src/modules/graph/GraphEngineDefaults.ts`
- `src/modules/graph/SchemaGraphRelations.ts`

**Acceptance.** Tests pass; lint/type-check clean; one commit.

---

## Phase F — Bench, CHANGELOG, PR

Re-run bench. Update CHANGELOG `[Unreleased]`. Open PR; wait for green CI; squash-merge.

---

## Execution order

1. **Wave 1 (parallel, disjoint files):** A, B, C, D, E
2. **Wave 2:** F (bench + CHANGELOG + PR)

Each phase ends with `npm run test:all` + `npm run type-check` + `npm run lint` green and one conventional commit.
