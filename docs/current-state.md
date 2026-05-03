# Current State

This file is a high-level snapshot, not the active implementation plan.

Verification status should be taken from the latest implementation run, not from this document.

## Status

The graph-native implementation is operational.

As of 2026-05-03, the latest full verification pass is clean:

- `npm run build`
- `npm run type-check`
- `npm run lint`
- `npm run test` -> 1006 smoke + unit tests passing
- `npm run test:integration` -> 372 integration tests passing
- `npm run test:e2e` -> 58 e2e tests passing
- `npm run test:types` -> 8 compile-time type-assertion suites passing
- `npm run pack:check` -> clean (628 files, 1.36 MB unpacked)
- `npm run bench`

What is implemented:

- JSON Schema as the authored source language
- project-owned compile-time type inference over schema literals
- external `$ref` compile-time inference through explicit references maps
- sound branch-union approximation for compile-time `if/then/else`
- canonical graph construction with semantics, relations, anchors, and NormIR
- graph-native validation with compiled and interpreted execution paths
- materialization plus quad-based ABox projection
- OWL JSON-LD and SHACL JSON-LD output via quad-backed adapters
- SHACL JSON-LD annotations for graph semantics not expressible in SHACL Core
- schema round-trip and graph artifact rehydration
- broader artifact round-trip coverage for anchors, conditionals, `contains`, and pattern properties
- production-hardened package surface, CLI path coverage, and registration rollback integrity
- reproducible benchmark command with smoke coverage for the compiled benchmark path
- vocabulary plugin system (`VocabularyPluginInterface`) for extensible custom RDF vocabularies
- CURIE expansion pipeline -- all RDF projections emit full IRIs instead of CURIE shortcuts
- `Curie` class and `CurieInterface` for compact URI expansion and compaction
- `fromQuads()` method for reconstructing typed JS objects from RDF quads
- `encode()` method for encoding decoded values to wire representation
- `json-tology/viz` package export with `HtmlRenderer`, `TypeStringEmitter`, `VizDataCollector`
- extended semantic predicates: `disjointWith`, `equivalentTo`, `inverseOf`, `transitive`, `symmetric`
- DCAT-AP 3.0.0 e2e test coverage with property-by-property graph comparison against official W3C SHACL and OWL

## Source of Truth

- Architecture, remediation, and active implementation plan: [`architecture-plan.md`](./architecture-plan.md)

## What Is Next

There is no open migration or hardening workstream at the moment.

Future changes should be opened as new scoped efforts and must follow the TDD
and verification rules in [`architecture-plan.md`](./architecture-plan.md).
