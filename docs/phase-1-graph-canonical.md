# Phase 1: Canonical Graph Enrichment

## Goal

Evolve `SchemaGraph` from a validation-focused structural index into the canonical semantic graph described in the architecture. All downstream consumers (GraphEngine, Materializer, GraphOntologySerializer) should read semantics from the graph rather than re-deriving them from raw schema objects.

## Current State

- `SchemaGraph` builds a node map, child map, entry map, indexed child map, and anchor map from the raw schema tree.
- `SchemaGraphSemantics` captures structural keywords (allOf, anyOf, properties, etc.) but does not model **semantic relations** like domain, range, datatype, cardinality, or constraint kind.
- `GraphEngine` re-extracts keyword values from raw `schema` objects via `buildNodePlan()` (~100 lines of keyword extraction per node). This is a second derivation path.
- `GraphOntologySerializer` walks the graph but also reaches into `node.schema` directly for type, format, description, title, enum, const, $ref — a third derivation path.

## Tasks

### 1.1 — Extend `SchemaGraphSemantics` with constraint metadata

Add fields that capture the semantic meaning of constraints, not just their keyword presence:

```typescript
interface SchemaGraphSemantics {
  // ... existing fields ...

  // New semantic fields
  title: string | undefined;
  description: string | undefined;
  format: string | undefined;
  defaultValue: unknown;
  hasDefault: boolean;
  constValue: unknown;
  hasConst: boolean;
  enumValues: unknown[] | undefined;
  minimum: number | undefined;
  maximum: number | undefined;
  exclusiveMinimum: number | undefined;
  exclusiveMaximum: number | undefined;
  multipleOf: number | undefined;
  minLength: number | undefined;
  maxLength: number | undefined;
  pattern: string | undefined;
  minItems: number | undefined;
  maxItems: number | undefined;
  uniqueItems: boolean;
  minProperties: number | undefined;
  maxProperties: number | undefined;
  additionalProperties: SchemaGraphNode | boolean | undefined;
  notNode: SchemaGraphNode | undefined;
  contentEncoding: string | undefined;
  contentMediaType: string | undefined;
  readOnly: boolean;
  writeOnly: boolean;
  deprecated: boolean;
}
```

### 1.2 — Migrate `GraphEngine.buildNodePlan()` to consume `SchemaGraphSemantics`

Replace the ~100-line keyword extraction in `buildNodePlan()` with reads from `graph.semantics(node)`. The `SchemaNodePlan` interface should be constructible directly from `SchemaGraphSemantics` plus the execution-specific fields (like compiled regex patterns, object validation plans).

This eliminates the second derivation path.

### 1.3 — Migrate `GraphOntologySerializer` to consume `SchemaGraphSemantics`

Replace all direct `node.schema` reads in the serializer with reads from `graph.semantics(node)`. The serializer should never need `isObject(node.schema)` or `node.schema.type` — those concepts should be expressed through the graph.

This eliminates the third derivation path.

### 1.4 — Add graph-level relation modeling

Add explicit domain/range/constraint relations to the graph:

```typescript
interface SchemaGraphRelation {
  kind: 'domain' | 'range' | 'subClassOf' | 'equivalentClass' | 'restriction' | 'memberOf';
  source: SchemaGraphNode;
  target: SchemaGraphNode | string; // string for external IRIs / XSD types
  metadata?: Record<string, unknown>;
}
```

Store relations on `SchemaGraph` so that `GraphOntologySerializer` can iterate relations directly rather than re-deriving OWL structure from keyword combinations.

## Validation

- All 258 existing tests must continue to pass.
- Add tests verifying that `SchemaGraphSemantics` captures all keyword values previously extracted by `buildNodePlan()`.
- Add tests verifying that `GraphOntologySerializer` produces identical output when reading from semantics vs. raw schema.

## Files Changed

- `src/schema/SchemaGraph.ts` — extend semantics, add relations
- `src/schema/GraphEngine.ts` — consume graph semantics in `buildNodePlan()`
- `src/ontology/GraphOntologySerializer.ts` — consume graph semantics
- `test/unit/schemaGraph.test.ts` — new semantics coverage
- `test/unit/schemaEngine.test.ts` — regression coverage

## Dependency

None — this is the foundation phase.
