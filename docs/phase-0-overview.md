# Implementation Phases — Overview

## Objectives

- **DevEx**: Clean, predictable APIs; strong TypeScript ergonomics; no surprise behaviors.
- **Code clarity**: Single semantic backbone (canonical graph); no parallel derivation paths.
- **Structural integrity**: Follow the architectural rules in CLAUDE.md and the end-state vision in `validation-engine-plan.md`.

## Semantic Parity Targets

Not feature-by-feature clones. Semantic conceptual parity with:

| System | What we match | What we skip |
|--------|--------------|--------------|
| **AJV** | Draft 2020-12 validation, formats, coercion, extensibility | JTD, standalone codegen to JS files |
| **TypeBox** | Value operations, transforms/codecs, composition, type inference | Builder API (we use declarative JSON Schema) |
| **json-schema-to-ts** | Schema-to-TypeScript inference, ref resolution, composition | We replace rather than wrap |
| **JSON-LD** | Graph identifiers, @context, @type, @graph, compaction/expansion concepts | Full JSON-LD processing API |
| **SHACL** | Shape serialization from canonical graph | SPARQL constraints, full SHACL engine |

## Phase Map

```
Phase 1: Canonical Graph Enrichment        [Foundation]
    ├── Phase 2: Engine Hardening          [Depends on 1 partially]
    ├── Phase 3: Materializer Unification  [Depends on 1 partially]
    └── Phase 4: Ontology from Graph       [Depends on 1]

Phase 5: Project-Owned Type Inference      [Independent, parallel]
```

### Phase 1 — Canonical Graph Enrichment
Enrich `SchemaGraphSemantics` with all constraint metadata. Add graph-level relations (domain, range, subClassOf). Eliminate direct `node.schema` reads in `GraphEngine` and `GraphOntologySerializer`.

### Phase 2 — Engine Hardening & Extensibility
Format plugin system. Custom keyword extensibility. Discriminator optimization. Edge case validation fixes.

### Phase 3 — Materializer Unification
Centralize engine creation. Move projection out of GraphEngine. Eliminate `relaxAdditionalProperties` hack. Add `Value.create()`. Unify Value/Materializer/Validator engine paths.

### Phase 4 — Ontology Serialization from Canonical Graph
Consume graph relations directly. Extend coverage (conditionals, contains, tuples). Add SHACL serialization.

### Phase 5 — Project-Owned Type Inference
Replace `json-schema-to-ts` with project-owned type inference. Handle transforms/brands natively. Gradual migration with comparison testing.

## Parallelism

- **Phases 2, 3, 5** can start immediately (their independent portions don't require Phase 1).
- **Phase 4** depends heavily on Phase 1's graph relations.
- Within each phase, tasks are ordered by dependency — earlier tasks unblock later ones.

## Success Criteria

1. All existing 258 tests pass at every phase boundary.
2. No module reaches into `node.schema` directly except `SchemaGraph.buildSemantics()`.
3. Ontology output is a projection of graph relations, not a re-derivation.
4. Custom formats and keywords can be registered without modifying engine source.
5. `Value.create()` generates valid default instances.
6. SHACL output available from the same graph.
7. Type inference works without `json-schema-to-ts` at runtime.
