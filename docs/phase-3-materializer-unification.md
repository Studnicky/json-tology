# Phase 3: Materializer Unification

## Goal

Make `Materializer` a thin projection layer over graph execution rather than a separate execution path. Unify the value operations so that `Value`, `Materializer`, and `SchemaRegistry` all delegate to the same graph-backed execution with different option profiles.

## Current State

- `Materializer` creates a **new** `GraphEngine` per call, bypassing the registry's cached engine.
- `Materializer.relaxAdditionalProperties()` does a `structuredClone` + delete — modifying schema structure outside the graph.
- `Value.cast/clean/convert/parse` each create new `GraphEngine` instances — no caching.
- `GraphEngine.materializeResult()` and `GraphEngine.projectAbox()` are engine methods that really belong to the materializer/projection layer.
- Three places create `GraphEngine` independently: `SchemaRegistry`, `Materializer`, `Value`, and `Validator`.

## Tasks

### 3.1 — Centralize engine creation

All engine creation should go through `SchemaRegistry` (or a shared engine factory). The registry already caches by `$id`. Extend it to support anonymous schemas (cache by content hash).

- `Validator` should delegate to a shared engine cache (it already has one, but it's separate from the registry).
- `Value` operations should use the same cache.
- `Materializer` should use `registry.getEngine()` instead of creating engines directly.

### 3.2 — Move `materializeResult` and `projectAbox` out of `GraphEngine`

These are projection operations, not validation. They should live in `Materializer`:

- `materializeResult(execution: GraphExecutionResult): unknown` — project validated value to JS
- `projectAbox(materialized: unknown, baseIRI: string): unknown[]` — convert to ABox nodes

This makes `GraphEngine` focused solely on validation/execution and `Materializer` focused on projection.

### 3.3 — Eliminate `relaxAdditionalProperties` hack

Instead of cloning the schema and deleting `additionalProperties`, handle `passAdditionalProperties` as an execution option on `GraphEngine`:

```typescript
interface GraphEngineOptions {
  // ... existing ...
  ignoreAdditionalProperties?: boolean;  // treat additionalProperties as absent
}
```

This avoids creating a modified schema copy that doesn't exist in the graph.

### 3.4 — Unify `Value` as convenience wrappers

`Value.cast`, `Value.clean`, `Value.convert`, `Value.parse` should be thin wrappers that configure execution options and call through a shared engine. Each should document its option profile clearly:

| Method    | coerce | defaults | removeAdditional | stripUnknown | collectErrors |
|-----------|--------|----------|------------------|--------------|---------------|
| cast      | ✓      | ✓        |                  |              |               |
| clean     |        |          |                  | ✓            |               |
| convert   | ✓      |          |                  |              |               |
| parse     | ✓      | ✓        | ✓                |              | ✓             |

### 3.5 — Value.create (generate defaults)

Add `Value.create(schema)` which generates a fully-defaulted instance from schema defaults and type-appropriate zero values:

- `type: "string"` → `""`
- `type: "number"` / `"integer"` → `0`
- `type: "boolean"` → `false`
- `type: "array"` → `[]`
- `type: "object"` → `{}` with properties recursively created
- `type: "null"` → `null`

Honors `default` values where declared. This fills the TypeBox `Value.Create()` gap.

## Validation

- All existing tests pass.
- Add tests for `Value.create()`.
- Verify `Materializer` produces identical output via centralized engine.
- Verify no performance regression from engine sharing.

## Files Changed

- `src/schema/GraphEngine.ts` — add `ignoreAdditionalProperties`, remove `materializeResult`/`projectAbox`
- `src/schema/Materializer.ts` — absorb projection methods, use registry engine
- `src/schema/Value.ts` — add `create()`, use shared engine
- `src/schema/Validator.ts` — use shared engine cache
- `src/schema/SchemaRegistry.ts` — expose engine factory
- `test/unit/value.test.ts` — `create()` tests
- `test/unit/materializer.test.ts` — regression

## Dependency

Partially depends on Phase 1 (graph semantics) for reading defaults from the graph. Engine centralization can proceed independently.
