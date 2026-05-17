# Architecture And Implementation Plan

This is the single live plan document for the repository.

All still-incomplete workstreams are tracked here. Older sidecar plan documents have been removed so there is one source of truth for architecture, remediation, and expansion work.

## Contract

json-tology has one authored source and three first-class consumers:

1. TypeScript compile-time inference from `as const` JSON Schema.
2. Runtime validation and materialization over the canonical graph.
3. JSON-LD serialization of both schema structure (TBox) and validated instances (ABox).

JSON Schema is the authored form. The canonical graph is the runtime artifact. JSON-LD output is projected from that graph. The implementation must not drift into separate semantic engines for typing, validation, ontology, or instance projection.

## Non-Negotiable Invariants

These rules govern every remaining workstream:

1. JSON Schema remains the authored source language.
2. `@types/json-schema` remains the intentional standards dependency for authoring types.
3. The graph remains the shared runtime artifact.
4. Validation semantics come from graph semantics, not serializer-specific logic.
5. RDF semantics are emitted as JSON-LD only in-core.
6. `materialize()`, `parse()`, `create()`, and `toQuads()` remain views over one runtime execution model.
7. Schema round-trip must stay lossless for the supported keyword surface.
8. Type inference must either model behavior correctly or fall back explicitly. Silent misresolution is not acceptable.
9. Versioning happens in git and releases, not in production runtime code.
10. Do not preserve backward compatibility via dual implementations, legacy loaders, or version branches inside active codepaths.
11. Completion claims must reflect the code that exists now, not the intended direction.
12. Vocabulary plugins extend ontology output without modifying core projection logic. Plugin prefixes merge into the active `Curie` instance; plugin relations are extracted after core extraction; plugin projection runs for non-core predicates.
13. The canonical bookstore at `examples/docs/bookstore/` is the single source of truth for every docs page, every example file, and every benchmark scenario. Docs prose, runnable examples, and bench fixtures all draw from the same registered schemas and `aboxFixtures`. New example files must import `bookstoreEntities` from the canonical registry; new docs pages must include their code via VitePress `<<<` directives against a runnable file in `examples/docs/`. Standalone synthetic schemas, mini-registries, and `JsonTology.create({...})` calls inside example files are forbidden — if a surface needs structure the canonical domain doesn't provide, the canonical domain expands to accommodate it. The canonical narrative is Bastian Balthazar Bux (the customer from the framing story of Michael Ende's *The Neverending Story*) ordering a rare 1979 first edition of *Die unendliche Geschichte* (Thienemann Verlag, ISBN-13 9783522128001); all fixture names are either real authors or characters from the book with realistic names. Pronouns referring to fixture personas are gender-neutral throughout.

## Verified Current State

The architectural migration, production-readiness hardening, and current
expansion slice are complete.

Completed and verified:

1. Legacy compatibility paths were removed from graph artifacts. There is one canonical artifact shape, one load path, and legacy artifacts fail loudly with regeneration guidance.
2. The publish surface is controlled. Builds clean `dist`, `package.json` uses an explicit `files` allowlist, and a committed pack-surface regression script validates the tarball.
3. Schema registration is atomic. Failed registration is a no-op and failed overwrite attempts preserve the prior valid entry and caches.
4. Transform contracts are aligned. `parse()` is decoded, while `materialize()` and `encode()` are typed and implemented as wire-form.
5. Public docs and exported surfaces were aligned. README examples use supported APIs, stale `json-schema-to-ts` claims were removed, and public API smoke coverage exists in `test/types`.
6. The shipped CLI is the CLI that is tested. Integration coverage runs the built `dist/cli.js`, verifies the published bin path, and locks the supported schema-path behavior in place.
7. Logger and loader posture is intentional. Routine trace logging no longer emits stack traces, and `SchemaLoader` is explicitly documented and tested as a lightweight filesystem loader rather than a standards validator.
8. Compile-time inference was expanded where the improvement is materially useful. External `$ref` resolution now supports explicit references maps, and `if/then/else` uses a documented sound branch-union approximation instead of collapsing to `unknown`.
9. SHACL JSON-LD coverage was expanded for graph semantics that SHACL Core cannot express directly. The serializer now emits explicit `jt:*` annotations for `multipleOf`, `minItems`, `maxItems`, and `uniqueItems`.
10. Artifact hardening expanded beyond the original corpus. Round-trip coverage now includes richer graphs with anchors, dynamic anchors, `contains`, `patternProperties`, and conditionals.
11. Benchmark reproducibility is verified. `npm run bench` completes cleanly, and the compiled-vs-interpreted benchmark path is locked down by a smoke test so nested-ref regressions fail in CI.

Latest verified commands:

- `npm run build`
- `npm run type-check`
- `npm run test`
- `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.test-types.json`
- `npm run pack:check`
- `npm run bench`

Latest verified result:

- runtime suite: 292 unit tests + 21 e2e tests passing
- compile-time type suite: clean
- publish-surface check: clean
- benchmark command: clean

## Current Status

There is no open migration or hardening workstream in the repository right now.

Future work should be opened as new scoped efforts when the project chooses to
expand standards coverage, DX evidence, or interoperability beyond the current
surface. Those future efforts must keep the same invariants and TDD discipline
defined below.

## Compatibility Policy

This repository does not preserve backwards compatibility inside the codebase through versioned interfaces, fallback loaders, or dual implementations.

When a representation changes:

1. keep one current implementation in code
2. reject old representations loudly
3. document the break
4. rely on git history and release versioning for historical access

## Required TDD Workflow

Every workstream in this plan must follow strict TDD:

1. Write or update the failing test first.
2. Run the focused test and confirm the failure is the intended one.
3. Implement the smallest change that makes the test pass.
4. Rerun the focused suite.
5. Run the full verification set.
6. Update docs only after code and tests match the new claim.

## Required Verification Commands

These are mandatory before claiming any future workstream is complete:

- `npm run build`
- `npm run type-check`
- `npm run test`
- `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.test-types.json`
- `npm run pack:check`
- `npm run bench` for any work that touches benchmarked paths or introduces
  performance / ergonomics claims

## Completion Rule

Do not mark any new workstream “done” because the current suite is green.

It is only acceptable to claim completion for a workstream when:

- the code change exists
- the focused regression tests exist
- the full verification commands pass
- the docs describe the implemented state accurately

## Public API Surface

Six package entry points control what consumers import. Internal imports reference defining files directly, not entry-point barrels.

| Entry point | Exports |
|---|---|
| `json-tology` | Error classes, error-code constants, `JsonTology`, `Compose`, `GraphEngine`, `Materializer`, `GraphOntologySerializer`, `OntologyBuilder`, `Curie`, `Lift`, `Projection`, `Skolemize`, `Transform`, `Changeset`, `Operations`, `Path`, `Resolver`, `Value`, `Hash`, `Loaders` |
| `json-tology/value` | `Changeset`, `Operations`, `Value`, `Hash` |
| `json-tology/schema` | `Compose`, `FormatRegistry`, `SchemaRegistry`, `Transform` |
| `json-tology/ontology` | `GraphOntologySerializer`, `GraphSchemaSerializer`, `GraphShaclSerializer`, `OntologyBuilder` |
| `json-tology/viz` | `HtmlRenderer`, `TypeStringEmitter`, `VizDataCollector` |
| `json-tology/types` | All type aliases (`FooType`) — compile-time only |
| `json-tology/interfaces` | All interface contracts (`FooInterface`) — compile-time only |

## File Inventory

All source files under `src/`. Organized by directory.

### Entry points (`src/`)

- `cli.ts` — CLI entry; delegates to `src/modules/cli/CliWriter.ts`
- `index.ts` — main package entry (`json-tology`)
- `JsonTology.ts` — top-level facade class; all public methods delegate to modules
- `ontology.ts` — `json-tology/ontology` entry
- `schema.ts` — `json-tology/schema` entry
- `value.ts` — `json-tology/value` entry
- `viz.ts` — `json-tology/viz` entry

### Constants (`src/constants/`)

Shared constant objects. All module-scoped constants belong here; modules import from this directory.

- `BASE_SCHEMAS.ts` — meta-schema base schema literals
- `COMPOSITION.ts` — composition keyword sets and class-axiom skip keys
- `DIALECT.ts` — dialect configuration and keyword sets
- `ERROR_CODES.ts` — machine-readable error code enums for all error classes
- `EXECUTION_OPTIONS.ts` — default execution option sentinels
- `FORMAT_PATTERNS.ts` — format pattern definitions
- `FORMAT_REGEXES.ts` — compiled regex objects for format validation
- `FORMAT_VALIDATION.ts` — format validator function map
- `GRAPH_REGEXES.ts` — compiled regex objects for graph-level parsing
- `IRI.ts` — IRI-related constants
- `JSONLD.ts` — JSON-LD keyword constants
- `LOGGER.ts` — logger configuration defaults
- `NUMERIC.ts` — numeric constraint constants
- `ONTOLOGY_PREDICATES.ts` — OWL/RDF predicate strings, cardinality kinds, projection handler maps
- `PAGINATION.ts` — pagination defaults
- `PATH.ts` — path-related constants
- `PREFIXES.ts` — default namespace prefix map
- `RESTRICTION.ts` — restriction descriptor constants
- `SCHEMA_KEYWORDS.ts` — JSON Schema keyword strings and primitive type lists
- `SCHEMAS.ts` — built-in schema constants
- `SHACL.ts` — SHACL predicate and node kind constants
- `UUID.ts` — UUID generation constants
- `VISUALIZATION.ts` — visualization layout and style constants
- `XSD_MAPS.ts` — XSD type-to-string maps and coercion tables

### Errors (`src/errors/`)

All error classes extend `BaseError`. Internal imports reference each file directly.

- `BaseError.ts` — base class with `code`, `retryable`, `cause`, `toJson()`, `flatten()`
- `CoercionError.ts` — coercion failures; carries `ValidationErrors` collection
- `GraphError.ts` — pointer resolution, anchor lookup, ref resolution, dialect issues
- `InstantiationError.ts` — schema instantiation failures
- `LoadError.ts` — filesystem and fetch load failures
- `MaterializationError.ts` — materialization and ABox validation failures
- `SchemaError.ts` — registration, missing `$id`, structure validation
- `ValidationErrors.ts` — collection class for accumulated validation errors

### Interfaces (`src/interfaces/`)

All interface declarations (`FooInterface`). Exported via `json-tology/interfaces`. Each file is a single interface.

- `ArrayResult.ts` — array validation result shape
- `BuildOptions.ts` — graph build option contract
- `Changeset.ts` — changeset interface
- `CliWriter.ts` — CLI output writer interface
- `CompiledNodeValidationPlan.ts` — compiled per-node validation plan
- `Compiler.ts` — schema compiler interface
- `Compose.ts` — composition operation interfaces
- `CompositionAccumulator.ts` — composition result accumulator
- `Config.ts` — registry configuration interface
- `Curie.ts` — CURIE prefix manager interface
- `CustomKeywordEntry.ts` — custom keyword registration shape
- `DefaultResolutionContext.ts` — default resolution context interface
- `Dump.ts` — dump/serialize option interfaces
- `DynamicScopeEntry.ts` — dynamic scope stack entry
- `Error.ts` — base error interface
- `FormatRegistry.ts` — format registry interface
- `GraphAccessor.ts` — read-only graph accessor interface
- `GraphArtifact.ts` — compiled graph artifact interface
- `GraphEngine.ts` — public graph engine interface (`GraphEngineInterface`)
- `GraphEngineImpl.ts` — internal graph engine implementation detail
- `index.ts` — barrel that re-exports all interface contracts
- `InternalExecutionResult.ts` — internal per-node execution result
- `Invariant.ts` — schema invariant interface
- `JsonSchemaObject.ts` — typed JSON Schema object interface
- `Logger.ts` — logger interface
- `Materializer.ts` — public materializer interface (`MaterializerInterface`)
- `MaterializerImpl.ts` — internal materializer implementation detail
- `ObjectResult.ts` — object validation result shape
- `Ontology.ts` — ontology builder interface
- `Prefetch.ts` — prefetch loader interface
- `Projection.ts` — RDF projection interface
- `PropCheck.ts` — property check context
- `Quad.ts` — quad interface
- `RdfJsQuad.ts` — RDF/JS quad interface
- `RefDecoder.ts` — ref decoder interface
- `RefResolutionLoader.ts` — ref resolution loader interface
- `Refs.ts` — ref visit context interface
- `RefTarget.ts` — resolved ref target interface
- `Registry.ts` — schema registry interface (`SchemaRegistryInterface`)
- `RelationIndex.ts` — graph relation index interface
- `ResolvedRef.ts` — resolved `$ref` result
- `Result.ts` — generic result interface
- `RootDialectPlan.ts` — root dialect plan interface
- `ScalarResult.ts` — scalar validation result shape
- `SchemaCompilerCheckExecutionContext.ts` — check execution context for schema compiler
- `SchemaCompilerGraphContext.ts` — graph context for schema compiler
- `SchemaCompilerImpl.ts` — internal schema compiler implementation interface
- `SchemaCompilerValidatePlanContext.ts` — validate-plan context for schema compiler
- `SchemaEntryStore.ts` — schema entry store interface
- `SchemaGraph.ts` — public schema graph interface (`SchemaGraphInterface`)
- `SchemaGraphImpl.ts` — internal schema graph implementation interface
- `SchemaIri.ts` — schema IRI interface
- `SchemaRefWalker.ts` — ref walker interface
- `SchemaRegistry.ts` — schema registry public interface
- `SchemaRegistryEntry.ts` — single registry entry shape
- `Serializer.ts` — serializer interface
- `SimplePredicateEntry.ts` — simple RDF predicate entry
- `Snapshot.ts` — registry snapshot interface
- `TransformBrand.ts` — transform brand interface
- `TransformFns.ts` — transform function map interface
- `TransformStage.ts` — transform stage interface
- `Unevaluated.ts` — unevaluated properties/items visit context
- `ValueImpl.ts` — internal value implementation interface
- `VisitComposition.ts` — composition visitor interface
- `VisitContext.ts` — graph visit context interface
- `Viz.ts` — visualization interface
- `VizOptions.ts` — visualization option interface
- `VocabularyPlugin.ts` — vocabulary plugin interface

### Types (`src/types/`)

All type aliases (`FooType`). Exported via `json-tology/types`. Compile-time only.

- `AboxOptions.ts` — ABox projection option types
- `BaseTypes.ts` — primitive base type aliases
- `Brand.ts` — branded type utilities
- `Compose.ts` — composition type aliases
- `Computed.ts` — computed property type aliases
- `ConstraintBrands.ts` — constraint-branded type aliases
- `Diff.ts` — diff type aliases
- `EffectiveOptions.ts` — effective option type aliases
- `ErrorCodes.ts` — error code type aliases
- `Format.ts` — format type aliases
- `GraphLookup.ts` — graph lookup type aliases
- `index.ts` — barrel that re-exports all type aliases
- `Infer.ts` — `InferType<T>` and related inference types
- `Invariant.ts` — invariant type aliases
- `JsonSchema.ts` — JSON Schema type aliases
- `JsonSchemaTypeName.ts` — JSON Schema type name union
- `JtConfig.ts` — `JsonTology` configuration type
- `Loader.ts` — loader option types
- `LookupSchema.ts` — schema lookup type aliases
- `NormalizedToQuadsOptions.ts` — normalized-to-quads option types
- `Quad.ts` — quad type aliases
- `RawRestrictionDescriptor.ts` — raw restriction descriptor type
- `Registry.ts` — registry type aliases
- `Restriction.ts` — restriction type aliases
- `RestrictionInfer.ts` — restriction inference types
- `Schema.ts` — schema type aliases
- `SchemaGraph.ts` — schema graph type aliases
- `SchemaLookup.ts` — schema lookup type aliases
- `SchemaRef.ts` — `$ref` type aliases
- `SchemaRegistryForEachCallback.ts` — `forEach` callback type
- `SchemaValidation.ts` — schema validation type aliases
- `Skolemize.ts` — skolemization type aliases
- `SpecialHandlerFn.ts` — special handler function type
- `SubjectGroup.ts` — RDF subject group type aliases
- `Transform.ts` — transform type aliases
- `TypeConfig.ts` — type configuration aliases
- `TypeErrors.ts` — compile-time type error types
- `Validation.ts` — validation type aliases
- `VisitFn.ts` — visitor function types

### Module: cli (`src/modules/cli/`)

- `CliWriter.ts` — CLI output formatter

### Module: composition (`src/modules/composition/`)

- `Compose.ts` — `allOf`, `anyOf`, `oneOf`, `not`, `if/then/else`, `extend` composition operations

### Module: data (`src/modules/data/`)

Shared data utilities. `DataTypes.ts` is the canonical location for type guards and shared helpers.

- `BaseTypes.ts` — base primitive type definitions
- `Changeset.ts` — changeset construction and application
- `DataTypes.ts` — type guards (`isRecord`, `isPlainObject`), `deepEqual`, `propertyIri`
- `Dumper.ts` — JSON dump and object serialization
- `Frozen.ts` — frozen-object utilities
- `Operations.ts` — value operation helpers
- `Path.ts` — JSON Pointer path utilities
- `Resolver.ts` — value resolver
- `Result.ts` — result re-export shim (delegates to `src/interfaces/Result.ts`)
- `StructuralHash.ts` — structural schema hashing
- `Value.ts` — `Value` class

### Module: format (`src/modules/format/`)

- `FormatRegistry.ts` — format validator registry; consumers register custom format validators

### Module: graph (`src/modules/graph/`)

Canonical graph construction and engine execution. `SchemaGraph.ts` is the canonical semantic graph. `GraphEngine.ts` consumes graph node kinds and relations directly.

- `GraphArtifact.ts` — compiled graph artifact
- `GraphEngine.ts` — graph execution engine; validates, parses, materializes, and encodes
- `GraphEngineDefaults.ts` — default engine option resolution
- `GraphEngineScalars.ts` — scalar validation paths
- `GraphEngineSupport.ts` — engine utility functions
- `GraphEngineVisit.ts` — graph traversal coordination
- `RefDecoder.ts` — `$ref` decode and registry lookup
- `SchemaGraph.ts` — canonical schema graph; builds and holds node and relation data
- `SchemaGraphRelations.ts` — relation construction helpers
- `SchemaGraphSupport.ts` — graph support utilities; primitive constraint and type keyword sets
- `SchemaIri.ts` — IRI construction for graph nodes

#### Module: graph/visit (`src/modules/graph/visit/`)

- `Refs.ts` — `$ref`, `$recursiveRef`, and `$dynamicRef` visit logic
- `Unevaluated.ts` — `unevaluatedProperties` and `unevaluatedItems` visit logic
- `VisitComposition.ts` — `allOf`, `anyOf`, `oneOf`, `not`, `if/then/else` visit logic

### Module: hash (`src/modules/hash/`)

- `Hash.ts` — `Hash` class; structural and identity hashing

### Module: loaders (`src/modules/loaders/`)

- `Loaders.ts` — filesystem and fetch schema loaders

### Module: materialization (`src/modules/materialization/`)

Materialization and ABox projection. `Materializer.ts` projects normalized graph execution into JS values and ABox nodes.

- `Materializer.ts` — `Materializer` class; projects graph execution results into typed instances

### Module: ontology (`src/modules/ontology/`)

Serialization over the canonical graph. Ontology output is a serialization of the canonical graph, not a separate semantic derivation.

- `BaseGraphSerializer.ts` — shared serializer base
- `GraphOntologySerializer.ts` — OWL JSON-LD serializer
- `GraphSchemaSerializer.ts` — JSON Schema serializer from graph
- `GraphShaclSerializer.ts` — SHACL JSON-LD serializer
- `OntologyBuilder.ts` — high-level ontology construction facade

### Module: rdf (`src/modules/rdf/`)

RDF/JSON-LD output. Projections read `graph.allRelations()` and emit vocabulary-specific quads.

- `Curie.ts` — CURIE prefix manager
- `JsonLdFormatter.ts` — converts quads to JSON-LD nodes
- `Lift.ts` — lifts JSON-LD instances into RDF quads
- `OwlProjection.ts` — OWL-specific quad projection
- `Projection.ts` — shared RDF projection base; predicate and handler maps
- `ProjectionIndex.ts` — relation-to-predicate index
- `QuadFactory.ts` — quad construction helpers
- `ShaclProjection.ts` — SHACL-specific quad projection
- `Skolemize.ts` — blank-node skolemization
- `VocabProjection.ts` — vocabulary plugin projection
- `XsdTypes.ts` — XSD type resolution helpers

### Module: registry (`src/modules/registry/`)

Schema registration and loading. Registration is atomic; failed registration is a no-op.

- `ComputedStore.ts` — computed schema store
- `InvariantStore.ts` — invariant storage and lookup
- `RefResolutionLoader.ts` — resolves `$ref` targets across registry entries
- `SameAsStore.ts` — `owl:sameAs` equivalence store
- `SchemaEntryStore.ts` — per-entry storage for registered schemas
- `SchemaRefWalker.ts` — walks schema `$ref` chains to build resolution index
- `SchemaRegistry.ts` — `SchemaRegistry` class; registers, loads, and caches schemas

### Module: transform (`src/modules/transform/`)

- `Transform.ts` — encode and decode transform registry

### Module: validation (`src/modules/validation/`)

Compiled validation. `SchemaCompiler` compiles graph nodes into executable validation plans.

- `Predicates.ts` — primitive predicate functions for scalar, format, and type checks
- `RefResolver.ts` — resolves `$ref` chains during compilation
- `SchemaCompiler.ts` — compiles graph nodes into validation plans
- `SchemaCompilerDefaults.ts` — default compiler option resolution
- `SchemaCompilerPlan.ts` — builds the per-node validation plan structure
- `SchemaCompilerSupport.ts` — compiler utility functions

#### Module: validation/exec (`src/modules/validation/exec/`)

Execution modules called by compiled validation plans.

- `Arrays.ts` — array constraint execution
- `Composition.ts` — composition constraint execution
- `Objects.ts` — object constraint execution
- `Scalars.ts` — scalar constraint execution

### Module: viz (`src/modules/viz/`)

HTML rendering and visualization utilities.

- `HtmlRenderer.ts` — renders schema graph as interactive HTML
- `TypeStringEmitter.ts` — emits TypeScript type string representations
- `VizDataCollector.ts` — collects graph data for visualization output
