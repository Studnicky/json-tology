# Audit Remediation Plan — 2026-05-14

Single feature branch: `chore/audit-fixes` → PR to `main`.

Each work item below has: scope, files touched, solution, and acceptance criteria. Items are grouped by phase. Phases must complete in order; items within a phase may run in parallel where noted.

---

## Phase 1 — Performance hot paths

### 1.1 Unified `SchemaGraph` cache through the registry

**Scope.** Eliminate redundant `new SchemaGraph(schema)` construction. `SchemaRegistry.graphOf()` is the single source.

**Files.**
- `src/modules/validation/SchemaCompiler.ts:109`
- `src/modules/materialization/Materializer.ts:184` (parallel `graphCache` field)
- `src/modules/registry/Resolver.ts:31` (RefResolver)
- `src/modules/validation/SchemaCompilerGraph.ts:437`
- `src/modules/data/Dumper.ts:67,231`
- `src/modules/registry/SchemaRegistry.ts:991`

**Solution.**
- `SchemaCompiler.compile(engine, graph)` accepts the registry-owned graph.
- `Materializer` consumes `registry.graphOf(schemaId)` directly; delete the local `graphCache` field.
- All other call sites switch to `registry.graphOf(schemaId)`.

**Acceptance.**
- Zero `new SchemaGraph(...)` outside `SchemaRegistry` and tests.
- `npm run test:all` green.
- `npm run bench` shows no regression (target: ≥10% improvement on `compile` and `materialize` paths).

### 1.2 Hoist closure context in `SchemaCompiler`

**Scope.** Stop allocating 8 fresh arrow closures per recursive compile call.

**Files.**
- `src/modules/validation/SchemaCompiler.ts:227–326` (`compileNodeCheck`)
- `src/modules/validation/SchemaCompiler.ts:389–410` (`compileNodeValidateWithErrors`)

**Solution.** Hoist the context object to a single `private readonly checkExecContext` field built once in the constructor, pre-bound to `this`. Reuse on every recursive call.

**Acceptance.**
- No object literal containing arrow closures inside the recursive compile functions.
- `npm run test:all` green.
- Benchmark: ≥15% improvement on `compile` for 100-node schemas.

### 1.3 Path prefix optimization in property validation

**Scope.** Hoist the `path === ''` ternary out of the per-property loop.

**Files.** `src/modules/validation/exec/Objects.ts:170,249,278`.

**Solution.** Compute `pathPrefix = path === '' ? '/' : path + '/'` once per `validateProperties`/`validatePatternProperties`/`validateAdditionalProperties` call; concatenate `pathPrefix + key`.

**Acceptance.** Tests green; bench shows no regression on validate path.

### 1.4 Single-walk property counting

**Scope.** Eliminate the second `Object.keys(obj)` walk in `validatePropertyCount`.

**Files.** `src/modules/validation/exec/Objects.ts:168`, `src/modules/validation/SchemaCompilerValidateExec.ts:260`.

**Solution.** Return the key count from the first walk; `validatePropertyCount` becomes a count-check only.

**Acceptance.** Tests green; no behavioral change on min/maxProperties errors.

### 1.5 Composition fast-path

**Scope.** When a node has no `allOf`/`anyOf`/`oneOf`/`not`/`if`, emit a specialized validator that skips the composition block entirely (no wrapper-object allocation).

**Files.** `src/modules/validation/SchemaCompilerValidateExec.ts:334–412`, `src/modules/validation/exec/Composition.ts`.

**Solution.** At plan time, short-circuit when `allOfValidators.length === 0 && anyOfChecks.length === 0 && oneOfChecks.length === 0 && complementCheck === undefined && ifCheck === undefined`. Emit a body that omits the composition block.

**Acceptance.** Tests green; composition tests (`test/unit/compose.test.ts` and adjacent) unchanged in behavior; bench shows no regression on simple schemas.

---

## Phase 2 — God-module decomposition

### 2.1 Collapse `SchemaCompiler*.ts` into two files

**Scope.** Unify the 6-file compiler split into `SchemaCompiler.ts` (entry/caching) + `SchemaCompilerPlan.ts` (single plan builder dispatched on mode).

**Files.**
- Keep: `src/modules/validation/SchemaCompiler.ts`
- New: `src/modules/validation/SchemaCompilerPlan.ts`
- Fold and delete: `SchemaCompilerCheckExec.ts`, `SchemaCompilerGraph.ts`, `SchemaCompilerValidatePlan.ts`, `SchemaCompilerValidateExec.ts`

**Solution.** Single `buildNodePlan(node, graph)` returns a plan object consumed by one exec table that dispatches on `mode: 'check' | 'validate'`. Property/keyword traversal happens once per node.

**Acceptance.**
- File count under `src/modules/validation/` reduced by 4.
- All validation tests green (smoke, unit, integration).
- No public API change.

### 2.2 Extract `SchemaEntryStore` from `SchemaRegistry`

**Scope.** Move entry storage (schemas Map, hash maps, revision counter, find/duplicates) out of `SchemaRegistry`.

**Files.**
- `src/modules/registry/SchemaRegistry.ts` (1162 LOC → target ~700 LOC)
- New: `src/modules/registry/SchemaEntryStore.ts`
- New: `src/interfaces/SchemaEntryStore.ts`

**Solution.** `SchemaRegistry` composes a `SchemaEntryStore` and delegates entry CRUD. Public API of `SchemaRegistry` unchanged.

**Acceptance.**
- `SchemaRegistry.ts` ≤ 750 LOC.
- All registry tests green.

### 2.3 Extract `SchemaRefWalker` from `SchemaRegistry`

**Scope.** Move ref walking (`collectEmbeddedIds`, `collectRefsInNode`, `assertRefsResolvable`, `collectUnresolvedRefIris`) into its own module.

**Files.**
- `src/modules/registry/SchemaRegistry.ts`
- New: `src/modules/registry/SchemaRefWalker.ts`
- New: `src/interfaces/SchemaRefWalker.ts`

**Solution.** Stateless walker class. `SchemaRegistry` delegates.

**Acceptance.**
- `SchemaRegistry.ts` ≤ 600 LOC after 2.2 + 2.3.
- All `$ref` resolution tests green.

### 2.4 Wrapper-object → in-place errors accumulator

**Scope.** Validation helpers stop returning `{ valid, errors[], value }` wrappers; they push into a caller-provided `errors[]` and return a boolean.

**Files.** `src/modules/validation/exec/Objects.ts`, `exec/Arrays.ts`, `exec/Composition.ts`, `exec/Scalars.ts`, and their callers.

**Solution.** Helper signature change. Mutation via the caller's `errors[]`. `value` returned only when the helper actually transforms.

**Acceptance.** Tests green; no allocation of wrapper result objects on the no-error path.

### 2.5 Lift `JsonTology._resolveAllRefs` into a loader-walker

**Scope.** Move ref-resolution orchestration out of `JsonTology.ts`.

**Files.**
- `src/JsonTology.ts` (1280 → ~1000 LOC target)
- New: `src/modules/registry/RefResolutionLoader.ts`

**Solution.** Extract the walker into its own class. `JsonTology` delegates.

**Acceptance.** `JsonTology.ts` ≤ 1050 LOC; loader tests green.

---

## Phase 3 — Standards compliance

### 3.1 Domain `Operations` class; drop Value wrappers

**Scope.** Promote `applyOp`, `clone` (currently free functions in `src/modules/data/Operations.ts`) into a proper static-method class. Remove the wrapper methods on `Value`.

**Files.**
- `src/modules/data/Operations.ts` — convert free functions to `class Operations { static apply(...); static clone(...); }`.
- `src/modules/data/Value.ts` — delete `Value.applyOp`, `Value.clone`, `Value.hash` (already in `Hash`). Keep instance methods (`cast`, `clean`, `convert`, `create`, `instantiate`) and `Value.diff` (delegates to internal `diffAt`, not a wrapper).
- `src/index.ts`, `src/value.ts` — export `Operations`.
- All call sites of `Value.applyOp`, `Value.clone`, `Value.hash` switch to `Operations.apply`, `Operations.clone`, `Hash.value`.

**Solution.** `Operations` class mirrors `Hash` shape (static-methods-only domain class). Public API: `Operations.apply(root, op)`, `Operations.clone(value)`. `Value.diff` stays because the `diffAt` walker is intrinsic to `Value` (not a wrapper).

**Acceptance.**
- No remaining `Value.applyOp`, `Value.clone`, `Value.hash` references anywhere in src/ or test/.
- `Operations` class exported from `./value` subpath.
- All tests green.
- CHANGELOG entry under "Changed" notes the API rename.

### 3.2 Move inline types/interfaces to canonical locations

**Files.**
- `src/JsonTology.ts:94` `NormalizedToQuadsOptionsType` → `src/types/NormalizedToQuadsOptions.ts`
- `src/cli.ts:243` `BuildOptionsInterface` → `src/interfaces/BuildOptions.ts`
- `src/cli.ts:337` `VizOptionsInterface` → `src/interfaces/VizOptions.ts`
- `src/modules/materialization/Materializer.ts:24` `AboxOptionsType` → `src/types/AboxOptions.ts`
- `src/modules/registry/SchemaRegistry.ts:67` `SchemaRegistryForEachCallback` → `src/types/SchemaRegistryForEachCallback.ts`
- `src/modules/data/Result.ts:9-19` `PassResultInterface`, `FailResultInterface` → `src/interfaces/Result.ts`
- `src/modules/rdf/Projection.ts:76` `SimplePredicateEntry` → `src/interfaces/SimplePredicateEntry.ts`
- `src/modules/rdf/Projection.ts:233` `SpecialHandlerFn` → `src/types/SpecialHandlerFn.ts`
- `src/modules/rdf/Projection.ts:462-474` `ProjectInstanceArgs`, `ProjectPropertyArgs` → `src/interfaces/Projection.ts`
- `src/modules/rdf/OwlProjection.ts:241` `RawRestrictionDescriptorType` → `src/types/RawRestrictionDescriptor.ts`

**Acceptance.** No inline type/interface declarations outside `src/types/` and `src/interfaces/` for these symbols. `npm run type-check` green.

### 3.3 Add missing interfaces for complex-contract classes

**Files.**
- `src/interfaces/SchemaIri.ts` ← `src/modules/graph/SchemaIri.ts`
- `src/interfaces/Unevaluated.ts` ← `src/modules/graph/visit/Unevaluated.ts`
- `src/interfaces/Refs.ts` ← `src/modules/graph/visit/Refs.ts`
- `src/interfaces/VisitComposition.ts` ← `src/modules/graph/visit/VisitComposition.ts`
- `src/interfaces/RefDecoder.ts` ← `src/modules/graph/RefDecoder.ts`

**Solution.** Each class gets an interface declaring its public contract. Class adds `implements FooInterface`. Consumers depend on the interface.

**Acceptance.** All five interfaces exist; their classes implement them; `npm run type-check` green.

### 3.4 Move module-scope constants to `src/constants/`

**Files.**
- `src/modules/data/BaseTypes.ts:12-13` `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` → `src/constants/PAGINATION.ts`
- `src/modules/rdf/Skolemize.ts:18,23` `UUID_BYTE_LENGTH`, `UUID_BYTE_MAX_PLUS_ONE` → `src/constants/UUID.ts`

**Acceptance.** Constants imported from `src/constants/`; tests green.

---

## Phase 4 — Test coverage

### 4.1 Direct unit tests for under-covered modules

Add `test/unit/<name>.test.ts` for each:
- `RefDecoder` — covering pointer/anchor/ref decoding, malformed inputs.
- `SchemaGraphRelations` — covering all relation extraction paths (domain/range, composition, refs).
- `ShaclProjection` — covering shape emission for each constraint kind.
- `OwlProjection` — direct unit (currently only transitively tested via `compose.test.ts`).

**Acceptance.** Each module has a dedicated unit-test file with at least 8 behavioral assertions; coverage report (`npm run test:coverage`) shows ≥80% line coverage for each.

---

## Phase 5 — Wrap-up

### 5.1 CHANGELOG entry

Add `## [Unreleased]` block with:
- **Changed**: unified graph cache; SchemaCompiler split collapsed; `Operations` class replaces `Value.applyOp`/`Value.clone`; `Value.hash` removed (use `Hash.value`).
- **Performance**: hoisted compile closures; composition fast-path; single-walk property counting.
- **Internal**: standards compliance — inline types moved, missing interfaces added, constants centralized.

### 5.2 PR to main

- Run `npm run test:all`, `npm run type-check`, `npm run lint`, `npm run bench`.
- Rebase on `main`.
- Open PR using `/enginseer:git-feature --push` workflow, body following `<◫>` template.
- Wait for green CI before merge.

---

## Execution rules

1. No deferred work. Every acceptance criterion must be met before declaring a phase complete.
2. Each phase ends with `npm run test:all` + `npm run type-check` + `npm run lint` green.
3. Sub-agents (sonnet) handle individual items; parallel where the file sets are disjoint, serial where they touch the same file.
4. After each item: commit with a conventional message (`perf:`, `refactor:`, `chore:`).
5. The audit findings document is `planning/audit-2026-05-14-plan.md` (this file). It is the source of truth; updates happen in place (no deltas).
