# Architecture Plan: json-tology

## Contract

json-tology has one authored source and three first-class consumers:

1. TypeScript compile-time inference from `as const` JSON Schema.
2. Runtime validation and materialization over the canonical graph.
3. RDF serialization of both schema structure (TBox) and validated instances (ABox).

JSON Schema is the authored form. The canonical graph is the runtime artifact. RDF output is projected from the graph. The implementation must not drift into separate semantic engines for typing, validation, ontology, or instance projection.

## Current Status

Reviewed against the code on 2026-03-13.

The prototype architecture is implemented and verified:

- `npm run type-check` passes
- `npm run test` passes
- `npx tsc --noEmit --project tsconfig.test-types.json` passes

Current suite status: 630 passing tests.

The earlier phase-by-phase migration is complete enough that it should no longer be tracked as active work. This document is now the live architectural contract and the guide for future expansion.

Detailed execution roadmap:
- [`expansion-hardening-plan.md`](/Users/studs/Workspace/json-tology/docs/expansion-hardening-plan.md)

## Implemented Architecture

### Authored Schema

- Source language: JSON Schema 2020-12 plus explicitly recognized extension keywords.
- Standards typing dependency kept intentionally: `json-schema` types.
- Unknown keywords are preserved for schema round-trip via graph semantics extensions.

### Compile-Time Typing

- Implemented in [`src/types/infer.ts`](/Users/studs/Workspace/json-tology/src/types/infer.ts).
- Reads schema object types directly.
- Covers the current project surface for refs, composition, conditionals, `not`, `contains`, transforms, and compose helpers.
- Fallback behavior is explicit where TypeScript cannot model runtime semantics precisely.

### Canonical Graph

- Implemented in [`src/modules/graph/SchemaGraph.ts`](/Users/studs/Workspace/json-tology/src/modules/graph/SchemaGraph.ts).
- Owns normalized nodes, semantic caches, anchors, refs, and relation extraction.
- Supports NormIR serialization and rehydration via [`src/modules/graph/GraphArtifact.ts`](/Users/studs/Workspace/json-tology/src/modules/graph/GraphArtifact.ts).

### Validation and Materialization

- Runtime execution lives in [`src/modules/graph/GraphEngine.ts`](/Users/studs/Workspace/json-tology/src/modules/graph/GraphEngine.ts).
- Compiled validation lives in [`src/modules/validation/SchemaCompiler.ts`](/Users/studs/Workspace/json-tology/src/modules/validation/SchemaCompiler.ts).
- Materialization and ABox projection live in [`src/modules/materialization/Materializer.ts`](/Users/studs/Workspace/json-tology/src/modules/materialization/Materializer.ts).
- ABox projection already uses the shared quad path.

### RDF Projection

- Shared quad model lives in [`src/modules/rdf/Quad.ts`](/Users/studs/Workspace/json-tology/src/modules/rdf/Quad.ts).
- Generic helpers and ABox projection live in [`src/modules/rdf/Projection.ts`](/Users/studs/Workspace/json-tology/src/modules/rdf/Projection.ts).
- OWL and SHACL quad projections live in:
  - [`src/modules/rdf/OwlProjection.ts`](/Users/studs/Workspace/json-tology/src/modules/rdf/OwlProjection.ts)
  - [`src/modules/rdf/ShaclProjection.ts`](/Users/studs/Workspace/json-tology/src/modules/rdf/ShaclProjection.ts)
- JSON-LD formatting lives in [`src/modules/rdf/JsonLdFormatter.ts`](/Users/studs/Workspace/json-tology/src/modules/rdf/JsonLdFormatter.ts).

### Public Serialization Surface

- OWL JSON-LD adapter:
  [`src/modules/ontology/GraphOntologySerializer.ts`](/Users/studs/Workspace/json-tology/src/modules/ontology/GraphOntologySerializer.ts)
- SHACL JSON-LD adapter:
  [`src/modules/ontology/GraphShaclSerializer.ts`](/Users/studs/Workspace/json-tology/src/modules/ontology/GraphShaclSerializer.ts)
- Schema round-trip serializer:
  [`src/modules/ontology/GraphSchemaSerializer.ts`](/Users/studs/Workspace/json-tology/src/modules/ontology/GraphSchemaSerializer.ts)
- User-facing API:
  [`src/JsonTology.ts`](/Users/studs/Workspace/json-tology/src/JsonTology.ts)

These serializers are now thin wrappers over projection + formatting. They should stay that way.
JSON-LD is the only supported RDF serialization target in-core. Consumers who need Turtle, N-Quads, or other RDF serializations should translate from the emitted JSON-LD with downstream tooling.

## Non-Negotiable Invariants

These are the rules future work must preserve.

1. JSON Schema remains the authored source language.
2. The graph remains the shared runtime artifact.
3. Validation semantics come from graph semantics, not serializer-specific logic.
4. RDF output is projected from graph-owned semantics and relations, not handwritten document assembly in public API layers.
5. `materialize()`, `parse()`, `create()`, and `abox()` must remain views over the same runtime execution model.
6. Schema round-trip must stay lossless for the supported keyword surface.
7. Type inference must either model behavior correctly or fall back explicitly; it must not silently misresolve.

## What Is No Longer Active Work

The following migration items should not be tracked as open work anymore:

- introducing the quad model
- moving ABox projection onto the quad path
- replacing the old semantic serializers with quad-backed adapters
- NormIR-based graph artifact support
- discriminator mapping execution
- schema round-trip as a regression gate

Those changes are already in the codebase and covered by tests.

## Active Expansion Tracks

The remaining work is no longer architectural cleanup. It is capability expansion.

### 1. Standards Coverage Expansion

Goal: continue closing the capability envelope against TypeBox, `json-schema-to-ts`, TypeScript, JSON-LD, SHACL, and AJV.

Priority areas:

- broader type-inference precision for difficult JSON Schema constructs
- more exhaustive SHACL and OWL projection coverage
- stronger external-ref and multi-schema compile-time ergonomics
- more formal behavior parity tests against supported JSON Schema features

Acceptance criteria:

- every newly claimed capability is backed by runtime tests and type tests
- unsupported constructs are documented as explicit fallbacks, not implied support

### 2. Interop and Artifact Hardening

Goal: make exported graph/schema/ontology artifacts safer for downstream tooling.

Priority areas:

- richer artifact versioning and compatibility guarantees
- build/CLI polish for ontology, SHACL, schema, and artifact export
- stronger round-trip and rehydration assertions across more schema corpora

Acceptance criteria:

- exported artifacts are reproducible
- artifact compatibility rules are documented
- CLI export formats stay covered by tests

### 3. Performance and DX Hardening

Goal: improve confidence that graph-native execution remains competitive and usable at scale.

Priority areas:

- benchmark coverage for compiled vs interpreted paths
- larger-schema registry behavior
- authoring ergonomics and compose/type helper polish

Acceptance criteria:

- performance claims are backed by reproducible benchmarks
- DX claims are backed by type tests and public API tests, not only internals

## Required TDD Workflow

All future work must follow strict TDD:

1. Add or update the failing test first.
2. Run the focused test and confirm it fails for the intended reason.
3. Implement the smallest change that makes it pass.
4. Run the touched focused suite again.
5. Run the full verification set before marking the work complete.
6. Update docs only after code and tests match the new claim.

Required verification commands:

- `npm run type-check`
- `npm run test`
- `npx tsc --noEmit --project tsconfig.test-types.json`

## Review Rule

Completion claims must be tied to the code that exists now, not to the intended direction. If a feature is only partially covered, describe it as partial. If a fallback exists, name it as a fallback. If a serializer or adapter is thin, keep it thin.
