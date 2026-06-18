# Architecture

This document describes the current architecture of json-tology: the contract it upholds, the canonical graph execution model, the public API surface, and the file inventory for every source module.

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
6. `materialize()`, `instantiate()`, `create()`, and `toQuads()` remain views over one runtime execution model.
7. Schema round-trip must stay lossless for the supported keyword surface.
8. Type inference must either model behavior correctly or fall back explicitly. Silent misresolution is not acceptable.
9. Versioning happens in git and releases, not in production runtime code.
10. Do not preserve backward compatibility via dual implementations, legacy loaders, or version branches inside active codepaths.
11. Completion claims must reflect the code that exists now, not the intended direction.
12. Vocabulary plugins extend ontology output without modifying core projection logic. Plugin prefixes merge into the active `Curie` instance; plugin relations are extracted after core extraction; plugin projection runs for non-core predicates.
13. The canonical bookstore at `examples/docs/bookstore/` is the single source of truth for every docs page, every example file, and every benchmark scenario. Docs prose, runnable examples, and bench fixtures all draw from the same registered schemas and `aboxFixtures`. New example files import `bookstoreEntities` from the canonical registry; new docs pages include their code via VitePress `<<<` directives against a runnable file in `examples/docs/`. Standalone synthetic schemas, mini-registries, and `JsonTology.create({...})` calls inside example files are forbidden — if a surface needs structure the canonical domain doesn't provide, the canonical domain expands to accommodate it. When an example legitimately needs a registry with a non-default option set (e.g. `enableTypeCast: true`), it seeds the new registry from `bookstoreSchemas` so every transitive `$ref` resolves. The ratchet at `scripts/check-docs-includes.mjs` enforces this with a ceiling of zero inline `\`\`\`ts` blocks in `docs/**/*.md` outside two explicit exemption categories: comparator `::: code-group` sections (peer-library comparisons), and blocks preceded by `<!-- inline-ts-ok: <reason> -->` (the marker rationale documents why the block cannot be a runnable file — removed/legacy API migration context, `.d.ts` module augmentation, type-shape pseudocode, function-signature pseudocode). There are no file-pattern exemptions; migration pages carry the `inline-ts-ok` marker on every block that references a removed API. The canonical narrative is Bastian Balthazar Bux (the customer from the framing story of Michael Ende's *The Neverending Story*) ordering a rare 1979 first edition of *Die unendliche Geschichte* (Thienemann Verlag, ISBN-13 9783522128001); all fixture names are either real authors or characters from the book with realistic names. Pronouns referring to fixture personas are gender-neutral throughout.
14. `QuadInterface` is a re-export of `@rdfjs/types#Quad` (the rdf/js data-model spec). Quads carry the spec-required `termType: 'Quad'`, `value: ''`, and `equals(other)`. `subject` is a `NamedNode | BlankNode`; `predicate` is a `NamedNode`; `object` is a `NamedNode | BlankNode | Literal`; `graph` is a `NamedNode | BlankNode | DefaultGraph` (non-optional, defaults to the singleton `DefaultGraph` term). `Literal.value` is `string` per the rdf/js spec; the JS type tag is carried in `Literal.datatype.value` (`xsd:integer`, `xsd:boolean`, `xsd:dateTime`, etc.). Use `Terms.iri(...)` / `Terms.blank(...)` / `Terms.literal(...)` / `Terms.defaultGraph()` / `Terms.quad(s, p, o, g?)` to construct terms and quads; use `decodeLiteral(literal)` to recover the typed JS value from a literal. RDF lists are emitted as the standard `rdf:first` / `rdf:rest` / `rdf:nil` triple chain; `Lists.build(items)` constructs the chain and `Lists.collect(head, allQuads)` walks it back. There is no project-internal list-term abstraction. External quads produced by `n3`, `@rdfjs/data-model`, `@graphy/core.data.factory`, or any other rdf/js-aware library are accepted as-is by `fromQuads` and `OntologyBuilder.addQuads`; `Lists.narrowExternalQuads(quads)` drops quads containing `Variable` or quoted-triple terms that this project does not support.
15. Schema registration is strict-by-default. `enableStrictGraph`, `enableInlineWarnings`, and `enableDuplicateDetection` default to `true`. Registering an inline primitive constraint or a structural duplicate raises `SchemaError` at registration time. Pass `enableStrictGraph: false` to `JsonTology.create({...})` or `new SchemaRegistry({...})` to restore permissive behaviour.
16. `fromTbox` / `OwlImporter` is the inverse of `toTbox`. It reads an OWL 2 TBox and reconstructs JSON Schema objects for every declared class. There is one import pipeline (`OwlImporter` with axiom dispatchers in `src/modules/ontology/importDispatch/`); a second semantic model for OWL import is not acceptable. The round-trip contract is `fromTbox ∘ toTbox ≈ identity` on the supported OWL 2 axiom set.
17. Codegen (`json-tology/owl-gen`) is a one-way build-step tool. It converts an OWL TBox into `as const` TypeScript schema literals via `generateFromTbox` (single-file) and `generateRegistryDirectory` (bookstore-layout directory). The generator is pure over the `OwlImporter` result; the generated source files are committed to the repo and not re-generated during `npm test` or `npm run build`.

## Verified Current State

The canonical graph is the single runtime artifact. Validation, materialization, ABox projection, OWL/SHACL serialization, and codegen all read from it. The implementation upholds these invariants:

1. One canonical artifact shape; one load path. Legacy artifact shapes fail loudly with regeneration guidance.
2. The publish surface is controlled. Builds clean `dist`, `package.json` uses an explicit `files` allowlist, and a committed pack-surface regression script validates the tarball.
3. Schema registration is atomic. Failed registration is a no-op; failed overwrite attempts preserve the prior valid entry and caches.
4. Transform contracts are directional. `parse()` decodes; `materialize()` and `encode()` produce typed wire-form output.
5. Public docs and exported surfaces are aligned. README examples use supported APIs and public API smoke coverage exists in `test/types`.
6. The shipped CLI is the CLI that is tested. Integration coverage runs the built `dist/cli.js` and locks the supported schema-path behavior.
7. Logger and loader posture is intentional. `Loaders` is a lightweight filesystem loader, not a standards validator.
8. Compile-time inference covers external `$ref` resolution via explicit references maps; `if/then/else` uses a documented sound branch-union approximation.
9. SHACL JSON-LD emits `jt:*` annotations for graph semantics SHACL Core cannot express directly: `multipleOf`, `minItems`, `maxItems`, `uniqueItems`.
10. Round-trip artifact coverage includes anchors, dynamic anchors, `contains`, `patternProperties`, and conditionals.
11. Benchmark reproducibility is verified. `npm run bench` completes cleanly; the single compiled validation path is exercised by a smoke test.

Mandatory verification commands:

```bash
npm run build
npm run type-check
npm run test
npm run type-check:tests:all
npm run pack:check
npm run bench   # for any work touching benchmarked paths or performance claims
```

## Compatibility Policy

This repository does not preserve backwards compatibility inside the codebase through versioned interfaces, fallback loaders, or dual implementations.

When a representation changes:

1. keep one current implementation in code
2. reject old representations loudly
3. document the break
4. rely on git history and release versioning for historical access

## TDD Discipline

All changes follow strict TDD:

1. Write or update the failing test first.
2. Run the focused test and confirm the failure is the intended one.
3. Implement the smallest change that makes the test pass.
4. Rerun the focused suite.
5. Run the full verification set.
6. Update docs only after code and tests match the new claim.

A change is complete only when:

- the code change exists
- the focused regression tests exist
- all verification commands pass
- the docs describe the implemented state accurately

## Public API Surface

Nine package entry points control what consumers import. Internal imports reference defining files directly, not entry-point barrels.

| Entry point | Exports |
|---|---|
| `json-tology` | Error classes, error-code constants, `JsonTology`, `Compose`, `GraphEngine`, `Materializer`, `GraphOntologySerializer`, `OntologyBuilder`, `Curie`, `Lift`, `Lists`, `Projection`, `Skolemize`, `Terms`, `decodeLiteral`, `Transform`, `Changeset`, `Operations`, `Path`, `Resolver`, `Value`, `Hash`, `Loaders`, `OwlImportError`, `OwlImportErrorCode` |
| `json-tology/value` | `Changeset`, `Operations`, `Value`, `Hash` |
| `json-tology/schema` | `Compose`, `FormatRegistry`, `SchemaRegistry`, `Transform` |
| `json-tology/ontology` | `GraphOntologySerializer`, `GraphSchemaSerializer`, `GraphShaclSerializer`, `OntologyBuilder` |
| `json-tology/owl-gen` | `generateFromTbox`, `generateRegistryDirectory`, `GenerateFromTboxOptions`, `GenerateRegistryDirectoryOptions`, `GenerateRegistryDirectoryEntityFile` — browser-safe; returns generated TypeScript source as strings with no file I/O |
| `json-tology/owl-gen-node` | `writeFromTbox`, `writeRegistryDirectory` — Node.js only; file-writing skin over `owl-gen` that imports `node:fs`/`node:path` and writes generated source to disk |
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
- `owl-gen.ts` — `json-tology/owl-gen` entry; `generateFromTbox` and `generateRegistryDirectory`; browser-safe (no `node:` imports; returns source strings)
- `owl-gen-node.ts` — `json-tology/owl-gen-node` entry; `writeFromTbox` and `writeRegistryDirectory`; Node.js only (filesystem writes via `node:fs`)
- `schema.ts` — `json-tology/schema` entry
- `value.ts` — `json-tology/value` entry
- `viz.ts` — `json-tology/viz` entry

### Constants (`src/constants/`)

Shared constant objects. All module-scoped constants belong here; modules import from this directory.

- `BASE_SCHEMAS.ts` — meta-schema base schema literals
- `COMPOSITION.ts` — composition keyword sets and class-axiom skip keys
- `DIALECT.ts` — dialect configuration and keyword sets
- `EMPTY_SEMANTICS.ts` — empty value handling sentinels
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
- `RESTRICTION.ts` — restriction descriptor constants
- `SCHEMA_KEYWORDS.ts` — JSON Schema keyword strings and primitive type lists
- `SCHEMAS.ts` — built-in schema constants
- `SHACL.ts` — SHACL predicate and node kind constants
- `STANDARD_PREFIXES.ts` — canonical prefix-to-namespace map for well-known RDF vocabularies (19 prefixes: `jt`, `owl`, `rdf`, `rdfs`, `xsd`, `schema`, `shacl`, etc.)
- `STRUCTURAL_HASH.ts` — hash algorithm constants for structural schema hashing
- `UUID.ts` — UUID generation constants
- `VISUALIZATION.ts` — visualization layout and style constants
- `XSD_FACETS.ts` — XML Schema facet definitions
- `XSD_MAPS.ts` — XSD type-to-string maps and coercion tables
- `XSD_REVERSE_MAPS.ts` — JS-to-XSD type reverse mappings

### Errors (`src/errors/`)

All error classes extend `BaseError`. Internal imports reference each file directly.

- `BaseError.ts` — base class with `code`, `retryable`, `cause`, `toJson()`, `flatten()`
- `CoercionError.ts` — coercion failures; carries `ValidationErrors` collection; code: `COERCION_FAILED`
- `DecodeError.ts` — failure inside a `decode` transform function; extends `TransformError`; code: `TRANSFORM_DECODE_FAILED`
- `EncodeError.ts` — failure inside an `encode` transform function; extends `TransformError`; code: `TRANSFORM_ENCODE_FAILED`
- `GraphError.ts` — pointer resolution, anchor lookup, ref resolution, dialect issues; codes: see `GraphErrorCode` in `src/constants/ERROR_CODES.ts`
- `InstantiationError.ts` — schema instantiation failures; codes: `INSTANTIATION_FAILED`, `EXTRA_FORBIDDEN`
- _(no LoadError class)_ — loader failures use `SchemaLoadErrorType` in `src/types/Loader.ts` (a discriminated union type, not an error class)
- `MaterializationError.ts` — materialization and ABox projection failures; codes: `MATERIALIZATION_FAILED`, `CYCLIC_DATA`, `INVALID_IRI_VALUE`, `NON_FINITE_NUMBER`, `MISSING_GRAPH_IRI`
- `OwlImportError.ts` — OWL import fatal conditions; carries `axiomIri` and `subjectIri`; code: `OWL_IMPORT_NOT_IMPLEMENTED`
- `SchemaError.ts` — registration, missing `$id`, structure validation; codes: see `SchemaErrorCode` in `src/constants/ERROR_CODES.ts`; includes `SchemaErrorCode.DUPLICATE_ID` (`SCHEMA_DUPLICATE_ID`) and `SchemaErrorCode.DUPLICATE_SHAPE` (`SCHEMA_DUPLICATE_SHAPE`) used by `SchemaRegistry` for duplicate detection
- `TransformError.ts` — base class for directional transform failures; adds `direction`, `schemaId?`, `path?`; not thrown directly by the library
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
- `OwlImport.ts` — `OwlImportResult` interface — shape returned by `fromTbox`; fields: `schemas`, `invariants`, `characteristics`, `sameAs`, `individuals`, `unsupported`
- `Prefetch.ts` — prefetch loader interface
- `Projection.ts` — RDF projection interface
- `PropCheck.ts` — property check context
- `Quad.ts` — `QuadInterface` — re-export of `@rdfjs/types#Quad`
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

### Type-organization convention

`src/types/` and `src/interfaces/` have a strict division of purpose enforced by a custom ESLint rule:

- **`src/types/`** — data substrate. Contains `FooType` type aliases: raw shapes, unions, branded primitives, option bags, and compile-time utilities. Types describe what data looks like.
- **`src/interfaces/`** — behavioral contracts. Contains `FooInterface` declarations: contracts that classes implement (method signatures, property contracts). Interfaces describe what objects can do.

The rule `interface-must-be-contract` rejects any `interface` that could be a `type` alias, and a companion location rule rejects `interface` declarations outside `src/interfaces/`. This is mechanically enforced on every commit — no exceptions.

Usage pattern:
- Use `FooInterface` for type annotations: parameter types, field types, return types.
- Use the class directly only for `new Foo()` or static method calls.
- Classes carry `implements FooInterface` clauses.
- Static-method-only classes (`Compose`, `Transform`, `Hash`) and the top-level facade (`JsonTology`) do not require separate interfaces.

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
- `DataTypes.ts` — type guards (`isRecord`, `isPlainObject`), `deepEqual`
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

- `AboxGraph.ts` — lazy, typed in-memory ABox instance graph over projected ABox quads unioned with the registry's TBox quads; exposes `resource` / `instances` entry points returning a fluent `Cursor`; reads associations (object-property edges, inverse-functional identities) directly from the TBox
- `Cursor.ts` — lazy, immutable selection of resource IRIs over an `AboxGraph`; navigation and refinement return a new cursor, terminals materialize the selection into typed instances
- `EffectiveProperties.ts` — the single effective-property walk shared by materialization, RDF lift, and ABox projection; collects own `properties`, `allOf` members, and `if/then/else` branches (first-declaration-wins, cycle-safe, cross-graph `$ref` resolution)
- `GraphArtifact.ts` — compiled graph artifact
- `GraphEngine.ts` — builds and caches `SchemaGraph` instances; exposes `semantics()` and the lookup functions consumed by `SchemaRegistry` and `SchemaCompiler`; validation runs through `registry.validator(id).validate()`
- `GraphEngineDefaults.ts` — default engine option resolution
- `GraphEngineScalars.ts` — scalar validation paths
- `GraphEngineSupport.ts` — engine utility functions
- `PredicateResolver.ts` — resolves and validates property predicate IRIs; rejects multi-fragment IRIs and control characters with `GraphError` code `INVALID_PREDICATE_IRI`
- `RefResolution.ts` — canonical single-source `$ref` → `{ graph, node }` resolver; all resolution paths (validation, projection, materialization) delegate here
- `QuadBackedSchemaGraph.ts` — `SchemaGraphInterface` implementation backed by OWL 2 quads; the structural inverse of `OwlProjection.graph()`, ingesting projected quads and reconstructing nodes and relations for the import dispatchers to traverse
- `RefDecoder.ts` — `$ref` decode and registry lookup
- `SchemaCursor.ts` — lazy, immutable selection of class IRIs in the TBox; navigation (`subClassOf`) and terminals lift each class IRI to its authored JSON Schema object
- `SchemaGraph.ts` — canonical schema graph; builds and holds node and relation data
- `SchemaGraphRelations.ts` — relation construction helpers
- `SchemaGraphSupport.ts` — graph support utilities; primitive constraint and type keyword sets
- `SchemaIri.ts` — IRI construction for graph nodes; provides `SchemaIri.propertyIri(classId, propertyName)` for graph-identity helpers; `parseRef` and `splitSubject` for ref/IRI decomposition

### Module: hash (`src/modules/hash/`)

- `Hash.ts` — `Hash` class; structural and identity hashing

### Module: loaders (`src/modules/loaders/`)

- `Loaders.ts` — filesystem and fetch schema loaders

### Module: materialization (`src/modules/materialization/`)

Materialization and ABox projection. `Materializer.ts` projects normalized graph execution into JS values and ABox nodes.

- `Materializer.ts` — `Materializer` class; projects graph execution results into typed instances

### Module: codegen (`src/modules/codegen/`)

OWL TBox → TypeScript source code generation. Pure functions with no filesystem side-effects; used by both the `owl-gen` CLI and the `generateFromTbox` / `generateRegistryDirectory` programmatic API.

- `OwlCodegen.ts` — `generateTypeScript(result, options)` — topological dep-sort, IRI → PascalCase name derivation, collision detection with `_2` suffix, sameAs / `addCharacteristic` emission

### Module: ontology (`src/modules/ontology/`)

Serialization over the canonical graph. Ontology output is a serialization of the canonical graph, not a separate semantic derivation.

- `BaseGraphSerializer.ts` — shared serializer base
- `GraphOntologySerializer.ts` — OWL JSON-LD serializer
- `GraphSchemaSerializer.ts` — JSON Schema serializer from graph
- `GraphShaclSerializer.ts` — SHACL JSON-LD serializer
- `OntologyBuilder.ts` — high-level ontology construction facade
- `OwlImporter.ts` — OWL 2 TBox import pipeline; constructs once, accepts multiple `import()` / `importAsync()` calls; stateless across calls

#### Module: ontology/importDispatch (`src/modules/ontology/importDispatch/`)

Axiom dispatchers for `OwlImporter`. Each dispatcher handles a subset of OWL 2 axioms and produces JSON Schema objects, invariants, characteristics, `sameAs` pairs, or individuals.

- `Annotations.ts` — `owl:sameAs`, `rdfs:subPropertyOf`
- `Characteristics.ts` — `owl:FunctionalProperty`, `owl:InverseFunctionalProperty`, `owl:TransitiveProperty`, `owl:SymmetricProperty`, `owl:AsymmetricProperty`, `owl:ReflexiveProperty`, `owl:IrreflexiveProperty`
- `ClassAxioms.ts` — `owl:Class`, `rdfs:subClassOf`, `owl:equivalentClass`, `owl:disjointWith`, `owl:complementOf`, `owl:disjointUnionOf`
- `ClassExpressions.ts` — `owl:intersectionOf`, `owl:unionOf`, anonymous class expression nodes
- `Datatypes.ts` — `owl:oneOf` enumerations → `enum`; XSD datatype range mapping; `rdfs:Datatype` with `owl:withRestrictions` facets
- `Individuals.ts` — `owl:NamedIndividual`, `rdf:type` assertions, data/object property assertions
- `Properties.ts` — `owl:ObjectProperty`, `owl:DatatypeProperty` with `rdfs:domain` / `rdfs:range` → JSON Schema `properties` entries
- `PropertyRestrictions.ts` — `owl:Restriction` with `owl:someValuesFrom`, `owl:allValuesFrom`, `owl:minCardinality`, `owl:maxCardinality`

### Module: quads (`src/modules/quads/`)

rdf/js quad and term primitives. This is a low layer (above `data/`, below `graph/`):
`graph/`, `registry/`, `materialization/`, and `rdf/` all import these primitives; the
primitives import only `data/`, `constants/`, `types/`, `interfaces/`, and `errors/`. They
never import `rdf/` (projection) or any higher module — this is the boundary that keeps the
onion intact and is what the `XSD_MAPS`/`XsdTypes` circular violated before extraction.

- `Curie.ts` — CURIE prefix manager
- `IdentifierIssuer.ts` — per-call blank-node counter; each projector call constructs its own issuer so concurrent serializations never share mutable counter state
- `Lists.ts` — RDF list construction (`Lists.build`), walking (`Lists.collect`), `Quad_Object` narrowing (`Lists.asQuadObject`), and external-quad narrowing (`Lists.narrowExternalQuads`). All access is through the `Lists` namespace object.
- `QuadFactory.ts` — quad/term construction with CURIE expansion and predicate-IRI validation. The boundary rule: `Terms.*` is the plain rdf/js term factory (no validation); `QuadFactory.*` is the graph-serialization-aware layer (CURIE expansion + predicate validation). Use `Terms` for raw term construction, `QuadFactory` for projection output.
- `Terms.ts` — rdf/js-spec term factory; produces `NamedNode` / `BlankNode` / `Literal` / `DefaultGraph` / `Quad` without requiring `@rdfjs/data-model` at runtime; exports `decodeLiteral(literal)` for typed-JS recovery
- `XsdTypes.ts` — XSD type resolution helpers (consume the pure-data maps in `src/constants/XSD_MAPS.ts`)

### Module: rdf (`src/modules/rdf/`)

RDF/JSON-LD output (projection layer). Projections read `graph.allRelations()` and emit vocabulary-specific quads, building terms via `quads/QuadFactory`.

- `JsonLdFormatter.ts` — converts quads to JSON-LD nodes; detects rdf:first/rdf:rest list heads and emits `@list`
- `JsonLdToQuads.ts` — inverse of `JsonLdFormatter`; converts compact JSON-LD back to `QuadInterface[]`
- `Lift.ts` — lifts external rdf/js quads into typed JS objects; decodes literals via `decodeLiteral`
- `OwlProjection.ts` — OWL-specific quad projection
- `Projection.ts` — shared RDF projection base; predicate and handler maps
- `ProjectionHelpers.ts` — shared helpers for `OwlProjection` and `ShaclProjection`: `propertySubjectIri`, `resolvePropertySchema`, `resolveRestrictionOnProperty`, `findAnnotatedEdgeStructure`
- `ProjectionIndex.ts` — relation-to-predicate index
- `QuadEmit.ts` — relation-index → literal-quad emit helpers (`emitLiterals`, `emitConstraintLiteral`) used by the OWL/SHACL projectors; delegates term construction to `quads/QuadFactory`
- `ShaclProjection.ts` — SHACL-specific quad projection
- `Skolemize.ts` — blank-node skolemization
- `VocabProjection.ts` — vocabulary plugin projection

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
- `ShaclValidator.ts` — native SHACL validation engine; consumes SHACL shape quads from `ShaclProjection` and ABox instance quads from `toQuads()`, returning a structured conformance report

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
