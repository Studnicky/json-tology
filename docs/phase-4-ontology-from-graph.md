# Phase 4: Ontology Serialization from Canonical Graph

## Goal

Make ontology serialization a direct projection of the canonical graph's semantic relations rather than a separate derivation from raw schema keywords.

## Current State

- `GraphOntologySerializer` walks `SchemaGraph` nodes but reads `node.schema` directly for most decisions (type, format, description, $ref, enum, const, required).
- The serializer re-derives OWL structure (subClassOf, unionOf, complementOf, restrictions) from keyword combinations — this is a parallel semantic derivation.
- The class-candidate heuristic checks raw schema keywords rather than graph-level node kinds.
- Property range resolution reads raw schema for `$ref`, `type`, and `format`.
- No support for conditional schemas (if/then/else) in ontology output.
- No support for `dependentSchemas` / `dependentRequired` in ontology output.
- No support for `contains` / `prefixItems` in ontology output.

## Tasks

### 4.1 — Consume graph relations for OWL structure (depends on Phase 1.4)

If Phase 1 adds `SchemaGraphRelation`, the serializer should iterate relations directly:

```typescript
for (const relation of graph.relations(node)) {
  switch (relation.kind) {
    case 'subClassOf': // → rdfs:subClassOf
    case 'domain':     // → rdfs:domain
    case 'range':      // → rdfs:range
    case 'restriction': // → owl:Restriction
    // ...
  }
}
```

This eliminates the parallel derivation and makes ontology output a true projection of the graph.

### 4.2 — Consume `SchemaGraphSemantics` for all metadata (depends on Phase 1.1)

Replace all `node.schema.title`, `node.schema.description`, `node.schema.type`, etc. reads with `graph.semantics(node).title`, `graph.semantics(node).schemaTypes`, etc.

### 4.3 — Extend ontology coverage

Add serialization support for schema constructs not currently covered:

- **if/then/else**: Model as conditional class membership or annotation
- **dependentSchemas**: Model as conditional property constraints
- **dependentRequired**: Already modeled via restrictions — verify completeness
- **contains**: Model as existential quantification (`owl:someValuesFrom`)
- **prefixItems**: Model as ordered property positions on tuples
- **patternProperties**: Model as property constraints with pattern metadata

### 4.4 — SHACL serialization

Add a `ShaclSerializer` alongside the OWL-based `GraphOntologySerializer`:

```typescript
class GraphShaclSerializer {
  serialize(graphs: ReadonlyArray<SchemaGraph>): unknown[]
}
```

SHACL maps more directly to JSON Schema constraints:
- `sh:NodeShape` ← object schemas
- `sh:PropertyShape` ← properties with constraints
- `sh:datatype` ← type + format
- `sh:minCount` / `sh:maxCount` ← required + cardinality
- `sh:pattern` ← pattern
- `sh:minLength` / `sh:maxLength` ← string constraints
- `sh:minInclusive` / `sh:maxInclusive` ← numeric constraints
- `sh:or` / `sh:and` / `sh:not` ← composition
- `sh:closed` ← additionalProperties: false

### 4.5 — Integrate SHACL output into `OntologyBuilder`

```typescript
class OntologyBuilder {
  // ... existing ...
  shacl(): string;          // Turtle format
  shaclObject(): unknown;   // JSON-LD format
}
```

## Validation

- Existing ontology tests pass unchanged.
- Add tests for new construct coverage (conditionals, contains, tuples).
- Add SHACL serialization tests.
- Compare OWL output before/after migration to verify no semantic regression.

## Files Changed

- `src/ontology/GraphOntologySerializer.ts` — consume graph semantics/relations
- `src/ontology/OntologyBuilder.ts` — add SHACL output methods
- New: `src/ontology/GraphShaclSerializer.ts`
- `test/unit/ontologyBuilder.test.ts` — extended coverage
- New: `test/unit/shaclSerializer.test.ts`

## Dependency

Depends on Phase 1 (graph semantics and relations). SHACL serializer can be developed in parallel once the graph interface is defined.
