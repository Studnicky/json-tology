# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-05-15

### Added

- Strict JSON Schema 2020-12 model types: `JsonSchema = boolean | JsonSchemaObject`, the `JsonSchemaObject` interface (every 2020-12 core/validation/format-annotation/content/meta-data vocabulary keyword), and the `JsonSchemaTypeName` union. Coexists with the existing loose runtime-boundary `JsonSchemaType`.
- Direct unit tests for `SchemaEntryStore`, `SchemaRefWalker`, `RefResolutionLoader`, `SchemaCompilerPlan`, `RefDecoder`, `SchemaGraphRelations`, `ShaclProjection`, `OwlProjection` (+100 new tests across two audit passes; suite now 1596 pass).

### Changed

- **BREAKING**: `Value.applyOp`, `Value.clone`, and `Value.hash` are removed. They were thin wrappers and now live where the work happens: `Operations.patch(value, op)` (renamed from `applyOp` so it does not collide with `Function.prototype.apply` in lint rules), `Operations.clone(value)`, and `Hash.value(value)`. `Operations` is exported from `json-tology/value`.
- `SchemaCompiler` is collapsed from six files into two: `SchemaCompiler.ts` (entry, caching, hoisted exec contexts) and `SchemaCompilerPlan.ts` (single plan builder). Property and keyword traversal runs once per node, dispatched on `mode: 'check' | 'validate'`.
- `SchemaRegistry` is decomposed. Entry storage moves to `SchemaEntryStore` (Map, hash index, revision counter, duplicate detection). Ref walking moves to `SchemaRefWalker` (embedded `$id`, ref collection, resolvability checks). Public API of `SchemaRegistry` unchanged.
- `JsonTology` ref-resolution orchestration moves to `RefResolutionLoader`. Public API of `JsonTology` unchanged.
- `SchemaRegistry.instantiate` / `cast` / `convert` accept an opt-out `clone: false` flag; Materializer uses it on the engine-output path.

### Performance

- `SchemaRegistry.graphOf(schemaId)` is the single source for `SchemaGraph` construction. Prior duplicate construction in `SchemaCompiler`, `Materializer`, `RefResolver`, and `Dumper` is eliminated. `Materializer.graphCache` is deleted; it now reads through the registry cache.
- `SchemaCompiler` hoists the recursive compile context (8 arrow closures per concern) into constructor-built `private readonly` fields. Recursive compile calls now pass a stable reference instead of allocating a fresh object literal.
- Property-path prefix computed once per `validateProperties` / `validatePatternProperties` / `validatePropertyNames` call instead of per key. Eliminates the `path === ''` ternary from the per-property hot loop.
- `validateProperties` returns the key count alongside its result; `validatePropertyCount` consumes the precomputed count, eliminating a second `Object.keys(obj)` walk for objects under min/maxProperties.
- Composition fast-path: when a node has no `allOf` / `anyOf` / `oneOf` / `not` / `if`, the emitted validator skips the composition block entirely. No calls to `validateAllOf` / `validateAnyOf` / `validateOneOf` / `validateNot` / `validateIfThenElse`, no wrapper-object allocations on the dominant no-composition path.
- Validation exec helpers (`Scalars`, `Arrays`, `Objects`, `Composition`) push into a caller-provided `errors[]` accumulator and return a boolean instead of allocating `{ valid, errors, value }` wrapper objects on every call. Ten helpers refactored.
- Interpreted-validation path is 3-4× faster. The `compiled vs interpreted` benchmark reports 250-330% throughput gains for the interpreted variant across simple-valid, simple-invalid, and nested-valid scenarios.
- `SchemaRegistry.graphEntry(id)` returns `{ schema, graph }` in one lookup. `Dumper.dump()` and `Dumper.resolveRef()` collapse two sequential `resolve() + store.get()` round-trips into one.
- `GraphEngine.visitContext` is hoisted to a constructor-built `private readonly` field. The 12-closure object literal is no longer allocated per `visit()`.
- `GraphEngine.execute()` reuses `this.options` directly when `overrides` is empty; the `{ ...this.options, ...overrides }` spread runs only when overrides carry keys.
- `GraphEngine.validateObject` walks `Object.keys(workingValue)` once instead of three times.
- `GraphEngine.resolveRef` uses a per-root cache map keyed by `ref` directly when the call targets the engine's own root graph, skipping per-call template-literal compound-key allocation.
- `SchemaGraphSupport.emptySchemaGraphSemantics()` returns a frozen module-scope singleton. The 60-field object is no longer allocated per boolean-schema node.
- `SchemaGraphSupport.extractSemantics()` returns a frozen `EMPTY_MAP` sentinel when a relation kind has no entries.
- `Materializer.run()` guards re-registration: `set(schema)` only runs when `!registry.has(schema.$id)`. `structuredClone`s eliminated on the two engine-output paths where ownership is already local.
- `FormatRegistry` date validation uses an integer-table day-in-month check + leap-year branch. The `new Date(...)` + `.toISOString()` allocations are gone.
- `FormatRegistry` built-in validators no longer wrap each inner function in a `(value) => typeof === 'string' && fn(value)` closure — type guards inlined; call site is monomorphic.
- `Projection.projectPropertyValue` no longer object-spreads the args struct per array element; `path` and `value` are explicit parameters.
- `OwlProjection.canonicalPropertyIri` performs one IRI parse instead of two.
- `VisitComposition` lazy-initializes `evaluatedProperties` / `evaluatedItems` Sets. `allOf` / `anyOf` / `oneOf` / `ifThenElse` branches that emit no evaluated members allocate no Set.

### Internal

- Inline type and interface declarations moved to canonical `src/types/` and `src/interfaces/` locations across two audit passes (13 symbols total): `NormalizedToQuadsOptionsType`, `BuildOptionsInterface`, `VizOptionsInterface`, `AboxOptionsType`, `SchemaRegistryForEachCallback`, `PassResultInterface`, `FailResultInterface`, `SimplePredicateEntry`, `SpecialHandlerFn`, `ProjectInstanceArgs`, `ProjectPropertyArgs`, `RawRestrictionDescriptorType`, `SchemaLookupType`, `GraphLookupType`.
- Public-contract interfaces declared for `SchemaIri`, `Unevaluated`, `Refs`, `VisitComposition`, `RefDecoder`, `SchemaEntryStore`, `SchemaRefWalker`, `RefResolutionLoader`.
- Module-scope constant clusters centralized in `src/constants/` (`PAGINATION`, `UUID`, `COMPOSITION`, `PATH`, `FORMAT_REGEXES`, `GRAPH_REGEXES`, `SHACL`, `BASE_SCHEMAS`; appended to `ONTOLOGY_PREDICATES`).
- ~32 JSDoc blocks on private/internal methods removed across `GraphEngine`, `SchemaIri`, `SchemaGraph`, `GraphEngineSupport`, `RefDecoder` per the project's "default no comments" rule.

### Docs

- `docs/value/clone-hash.md`, `docs/value/diff.md`, `docs/value/index.md`, `docs/benchmarks.md`, `docs/getting-started.md`, and the bench scenario runner updated to the `Operations` / `Hash` API.

## [0.6.0] - 2026-05-14

- Interpreted-validation path is 3-4× faster. `compiled vs interpreted` benchmark now reports 250-330% throughput gains for the interpreted variant across simple-valid, simple-invalid, and nested-valid scenarios.
- `SchemaRegistry.graphEntry(id)` returns `{ schema, graph }` in one lookup. `Dumper.dump()` and `Dumper.resolveRef()` collapse two sequential `resolve() + store.get()` round-trips into one — recovers most of the prior `dump nested` regression.
- `GraphEngine.visitContext` is hoisted to a constructor-built `private readonly` field. The 12-closure object literal is no longer allocated per `visit()`.
- `GraphEngine.execute()` reuses `this.options` directly when `overrides` is empty; the `{ ...this.options, ...overrides }` spread runs only when overrides carry keys.
- `GraphEngine.validateObject` walks `Object.keys(workingValue)` once instead of three times.
- `GraphEngine.resolveRef` uses a per-root cache map keyed by `ref` directly when the call targets the engine's own root graph, skipping per-call template-literal compound-key allocation.
- `SchemaGraphSupport.emptySchemaGraphSemantics()` returns a frozen module-scope singleton. The 60-field object is no longer allocated per boolean-schema node.
- `SchemaGraphSupport.extractSemantics()` returns a frozen `EMPTY_MAP` sentinel when a relation kind has no entries.
- `Materializer.run()` guards re-registration: `set(schema)` only runs when `!registry.has(schema.$id)`.
- `Materializer` `structuredClone`s eliminated on the two engine-output paths where ownership is already local; `SchemaRegistry.instantiate`/`cast`/`convert` gain an opt-out `clone: false` flag used by Materializer.
- `FormatRegistry` date validation uses an integer-table day-in-month check + leap-year branch. The `new Date(...)` + `.toISOString()` allocations are gone.
- `FormatRegistry` built-in validators no longer wrap each inner function in a `(value) => typeof === 'string' && fn(value)` closure — type guards inlined; call site is monomorphic.
- `Projection.projectPropertyValue` no longer object-spreads the args struct per array element; `path` and `value` are explicit parameters.
- `OwlProjection.canonicalPropertyIri` performs one IRI parse instead of two.
- `VisitComposition` lazy-initializes `evaluatedProperties` / `evaluatedItems` Sets. `allOf`/`anyOf`/`oneOf`/`ifThenElse` branches that emit no evaluated members allocate no Set.

### Changed (audit pass 2 — internal)

- 2 type aliases moved from `RefDecoder.ts` to `src/types/`.
- 7 module-scope constant clusters moved to `src/constants/` (`COMPOSITION`, `PATH`, `FORMAT_REGEXES`, `GRAPH_REGEXES`, `SHACL`, appended to `ONTOLOGY_PREDICATES` and `UUID`).
- 10 inline schema definitions moved from `src/modules/data/BaseTypes.ts` to `src/constants/BASE_SCHEMAS.ts`.
- ~32 JSDoc blocks on private/internal methods removed across `GraphEngine`, `SchemaIri`, `SchemaGraph`, `GraphEngineSupport`, `RefDecoder`.

### Added (audit pass 2)

- Direct unit tests for `SchemaEntryStore`, `SchemaRefWalker`, `RefResolutionLoader`, and `SchemaCompilerPlan` (+61 new tests; suite now 1596 pass).
- Strict JSON Schema 2020-12 model types: `JsonSchema`, `JsonSchemaObject` (interface), and `JsonSchemaTypeName`. Coexists with the loose runtime-boundary `JsonSchemaType`.

### Docs (audit pass 2)

- `docs/value/clone-hash.md`, `docs/value/diff.md`, `docs/value/index.md`, `docs/benchmarks.md`, `docs/getting-started.md`, and the bench scenario file updated to the `Operations`/`Hash` API.

### Changed

- **BREAKING**: `Value.applyOp`, `Value.clone`, and `Value.hash` are removed. They were thin wrappers and now live where the work happens: `Operations.patch(value, op)` (renamed from `applyOp` so it does not collide with `Function.prototype.apply` in lint rules), `Operations.clone(value)`, and `Hash.value(value)`. `Operations` is exported from `json-tology/value`.
- `SchemaCompiler` is collapsed from six files into two: `SchemaCompiler.ts` (entry, caching, hoisted exec contexts) and `SchemaCompilerPlan.ts` (single plan builder). Property and keyword traversal runs once per node, dispatched on `mode: 'check' | 'validate'`.
- `SchemaRegistry` is decomposed. Entry storage moves to `SchemaEntryStore` (Map, hash index, revision counter, duplicate detection). Ref walking moves to `SchemaRefWalker` (embedded `$id`, ref collection, resolvability checks). Public API of `SchemaRegistry` unchanged.
- `JsonTology` ref-resolution orchestration moves to `RefResolutionLoader`. Public API of `JsonTology` unchanged.

### Performance

- `SchemaRegistry.graphOf(schemaId)` is the single source for `SchemaGraph` construction. Prior duplicate construction in `SchemaCompiler`, `Materializer`, `RefResolver`, and `Dumper` is eliminated. `Materializer.graphCache` is deleted; it now reads through the registry cache.
- `SchemaCompiler` hoists the recursive compile context (8 arrow closures per concern) into constructor-built `private readonly` fields. Recursive compile calls now pass a stable reference instead of allocating a fresh object literal.
- Property-path prefix computed once per `validateProperties`/`validatePatternProperties`/`validatePropertyNames` call instead of per key. Eliminates the `path === ''` ternary from the per-property hot loop.
- `validateProperties` returns the key count alongside its result; `validatePropertyCount` consumes the precomputed count, eliminating a second `Object.keys(obj)` walk for objects under min/maxProperties.
- Composition fast-path: when a node has no `allOf`/`anyOf`/`oneOf`/`not`/`if`, the emitted validator skips the composition block entirely. No calls to `validateAllOf`/`validateAnyOf`/`validateOneOf`/`validateNot`/`validateIfThenElse`, no wrapper-object allocations on the dominant no-composition path.
- Validation exec helpers (`Scalars`, `Arrays`, `Objects`, `Composition`) push into a caller-provided `errors[]` accumulator and return a boolean instead of allocating `{ valid, errors, value }` wrapper objects on every call. Ten helpers refactored.

### Internal

- Inline type and interface declarations moved to canonical `src/types/` and `src/interfaces/` locations: `NormalizedToQuadsOptionsType`, `BuildOptionsInterface`, `VizOptionsInterface`, `AboxOptionsType`, `SchemaRegistryForEachCallback`, `PassResultInterface`, `FailResultInterface`, `SimplePredicateEntry`, `SpecialHandlerFn`, `ProjectInstanceArgs`, `ProjectPropertyArgs`, `RawRestrictionDescriptorType`.
- Public-contract interfaces declared for `SchemaIri`, `Unevaluated`, `Refs`, `VisitComposition`, `RefDecoder`.
- Pagination constants (`DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`) centralized in `src/constants/PAGINATION.ts`; UUID constants in `src/constants/UUID.ts`.
- Direct unit-test coverage added for `RefDecoder`, `SchemaGraphRelations`, `ShaclProjection`, `OwlProjection` (39 new tests).

## [0.6.0] - 2026-05-14

### Added

- `JsonTology.prefetch({ loader, schemas?, rootIds?, baseIRI? })` walks transitive `$ref` IRIs via a loader and returns a `SnapshotInterface { version: 1; schemas: ReadonlyMap<string, JsonSchemaType>; provenance? }` keyed by `$id`. Throws `GraphError('REF_UNRESOLVED')` when the loader returns `null` for a required IRI; loader-thrown errors propagate.
- `prefetched?: SnapshotInterface` option on `JsonTology.create`. Schemas passed via `schemas` register first; entries from the snapshot then fill any IRIs not already in the registry — `schemas` wins on collision.
- `SchemaRegistryInterface` mirrors the surface of a native `Map<string, Schema>`. Reads: `has`, `get`, `keys`, `values`, `entries`, `forEach`, `size`, `[Symbol.iterator]`. Writes: `set(schema, iri?)` and `set([schema | [schema, iri], ...])` (schema-first ordering, replace on collision per `Map.set`), `delete(iri)` (returns boolean), `clear()`.
- `SchemaRegistryInterface.revision` — monotonic counter bumped on every mutation. Drives the ontology cache and is available for external consumers that cache derived views.
- `SnapshotInterface`, `SnapshotProvenanceInterface`, and `PrefetchOptionsInterface` exported from `json-tology/interfaces`.
- Docs: `/comparisons` — capability matrix across 11 comparator libraries (Zod, Valibot, TypeBox, AJV, Pydantic, Yup, Joi, io-ts, Effect Schema, ArkType, Runtypes).
- Docs: `/benchmarks` — per-scenario in-browser runner. Every scenario shows the source code (via vitepress includes), a Run-in-browser button that loads each comparator from its esm.sh CDN entry on demand (json-tology imports from local `src/` via Vite alias so the page measures HEAD), and the canonical Node-side results. Every library has a row in every scenario; where a library lacks a primitive the row runs the userland equivalent the library's consumers would actually write.
- The bench suite now lives at `examples/docs/benchmarks/` as runnable examples linked to GitHub source. `npm run bench:report` writes the consolidated `results/latest.md` and per-scenario fragments under `results/scenarios/`.

### Changed

- **BREAKING**: `JsonTology.create` is synchronous on every call site. The `loader` option is removed from `JsonTologyOptionsInterface`. Async transitive resolution lives entirely in `JsonTology.prefetch`. Migration: replace `await JsonTology.create({ loader, schemas })` with `const snapshot = await JsonTology.prefetch({ loader, schemas }); JsonTology.create({ prefetched: snapshot, schemas })`.
- **BREAKING**: `register` is renamed `set` on `SchemaRegistryInterface`, `JsonTology`, and `FormatRegistryInterface`. The merged write surface takes the schema first, with an optional explicit key as the second argument: `set(schema)`, `set(schema, iri)`, or `set(entries[])` where each entry is either a schema or a `[schema, iri]` tuple. `JsonTology.set` widens `TMap`. `FormatRegistry.set(name, validator)` keeps Map's `(key, value)` ordering (no schema involved). Semantics shift: `set` replaces silently per `Map` contract; the previous `register`-with-different-content throw is gone.

### Removed

- **BREAKING**: `jt.registerAsync(schema)` is gone. Federation runs through `JsonTology.prefetch` only; `jt.set(schema)` remains for sync registration of schemas whose refs are already resolved.
- **BREAKING**: `jt.has(iri)`, `jt.get(iri)`, and `jt.list()` facade methods removed. There is one path to registry reads: `jt.registry.has(iri)`, `jt.registry.get(iri)`, `[...jt.registry.keys()]`. The registry exposes the full Map-like read surface.
- **BREAKING**: `register()` removed from `SchemaRegistryInterface`, `JsonTology`, and `FormatRegistryInterface`. Replaced by `set` (see Changed). `registerAnonymous` stays because it generates a hash key — distinct verb from `Map.set`.

### Security

- npm overrides force `vite` to `^6.4.2` and `esbuild` to `^0.25.0` to resolve [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) (vite path traversal in optimized deps `.map` handling) and [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (esbuild dev server request smuggling). Both surfaces are dev-only (vitepress docs build); production bundles unaffected.

## [0.5.0] - 2026-05-13

### Added

- `LoaderType = (iri: string) => Promise<JsonSchemaType | null>` — pluggable async schema-fetch hook exported from `json-tology/types`.
- `Loaders` namespace (exported from `json-tology`) with four universal helpers: `Loaders.fetch({ base?, init? })` (uses `globalThis.fetch`, works in Node ≥ 18, Bun, Deno, browsers), `Loaders.compose(...loaders)` (first non-null wins), `Loaders.cached(loader, { maxSize? })` (LRU, default 1024, caches null too), `Loaders.memory(map)` (in-memory lookup for tests / bundled schemas). No Node-only built-ins — zero new runtime dependencies.
- `loader?: LoaderType` on `JsonTologyOptionsInterface`. When provided, `JsonTology.create()` returns `Promise<JsonTology>` and eagerly resolves all transitive `$ref` IRIs before yielding a fully-warmed instance. If the loader returns `null` for a required IRI, throws `GraphError('REF_UNRESOLVED')` with the IRI. Without a loader the existing sync API is unchanged.
- `jt.registerAsync(schema)` — post-construction async registration that walks transitive refs via the configured loader. Requires a loader at construction time.
- Docs: `docs/advanced/schema-federation.md` — how the loader hook integrates with `$ref` resolution, write-your-own loader examples, performance notes, error handling, comparison with AJV `loadSchema` and SPARQL `SERVICE`.
- Docs: `docs/advanced/browser-usage.md` — universal (CDN, bundler, Node) usage guide using the loader hook as the central federation primitive. No environment-specific export paths.

### Removed

- **BREAKING**: `SchemaLoader` class (`src/modules/registry/SchemaLoader.ts`) — the Node-only file reader was the sole reason for any browser/node conditional export complexity. Migration: read the JSON file yourself with `node:fs` and pass the parsed schemas to `JsonTology.create({ schemas: [...] })`, or supply `loader: async (iri) => { const content = await fs.promises.readFile(path); return JSON.parse(content); }` to resolve on demand.
- `SchemaLoaderInterface` removed from `src/interfaces/`.
- `SchemaLoadErrorType` and `SchemaLoadResultType` remain exported from `json-tology/types` (they are inferred from the SCHEMAS constants and not load-bearing on SchemaLoader).

### Changed

- `JsonTology.create()` is now overloaded: `create({ loader })` → `Promise<JsonTology>`, `create({})` → `JsonTology` (existing sync form unchanged). TypeScript infers the return type from whether `loader` is present.
## [0.4.3] - 2026-05-13

### Added

- Browser compatibility: `FormatRegistry` no longer depends on `node:net` or `node:url`. The library imports zero `node:*` modules outside `cli.ts`, `SchemaLoader.ts`, and `CliWriter.ts`. The `./schema` subpath exposes a browser-safe variant via the `exports` map `browser`/`node`/`default` conditions: browsers and bundlers receive a `SchemaLoader`-free entry; Node consumers keep the full surface. `docs/browser-usage.md` covers ESM-via-CDN and bundler usage.
- Compile-time enforcement of OWL 2 property-characteristic conflicts. Setting `symmetric` + `asymmetric`, `reflexive` + `irreflexive`, or `asymmetric` + `reflexive` together on the same property now surfaces a `PropertyCharacteristicConflictInterface` branded type error at the offending line. Runtime registration throws `SchemaError` with code `PROPERTY_CHARACTERISTIC_CONFLICT`. OWL property characteristics now carry the **Compile-time + Runtime** validation badge.
- Template conformance: 7 reference pages now follow the canonical `Examples / Bad examples / Comparison / Related / See also` structure: `validation/subschemaAt`, `composition/equivalent`, `composition/restrictions`, `advanced/sameas`, `advanced/utilities`, `serialization/toSchema`, `registry/find-duplicates`.
- `docs/usage-examples/class-hydration-orm.md` extracts the TypeORM / Prisma / Mikro-ORM / Drizzle / DDD / Active Record recipes out of `class-hydration.md`. `getting-started.md` trims to ~200 LOC by extracting "All `JsonTology.create` options" to `static-helpers.md`.

### Changed

- **BREAKING**: `Transform.pipe()` renamed to `Transform.chain()`. The previous name conflicted with the Node.js stream `.pipe()` convention. The supporting types are similarly renamed: `PipeChainMismatchInterface` → `ChainMismatchInterface`; `PipeChainSchemaMismatchInterface` → `ChainSchemaMismatchInterface`; `ValidatePipeChainType` → `ValidateChainType`; `PipeChainOutputType` → `ChainOutputType`; `PipeChainRecursionCap` → `ChainRecursionCap`. Migrate by replacing every `Transform.pipe` call site with `Transform.chain` and renaming any type imports.
- Docs style: every `{ decode, encode }` transform-stage literal is now formatted with `decode` and `encode` on separate lines (project convention).
- Docs IA: 7 reference pages split for scope — `types.md` → `types/{infer,utility,ranges}.md`; `constraint-brands.md` → `constraint-brands/{keywords,narrowing}.md`; `bookstore-domain.md` → extracted OWL taxonomy to `usage-examples/bookstore-owl-taxonomy.md`; `advanced/graph-concepts.md` → `graph-concepts.md` (fundamentals) + `graph-internals.md` (implementation); `schemas.md` deduplicated against registry pages (673 → 176 LOC); `usage-examples/sparql-queries.md` folded into `advanced/ontology.md`; `references/benchmarks.md` folded into `references.md`.

## [0.4.2] - 2026-05-13

### Fixed

- `BookstoreGraph` (`docs/your-types-are-a-graph.html`) was missing the `BookListPage → Book` edge because the visualization's `refTarget()` only recognised `items.$ref` and not the inline `items.$id` pattern produced by `BaseTypes.page()`. Extended `refTarget()` to fall back to `items.$id` when `items.$ref` is absent.
- Sidebar anchor navigation was broken on 5 links: three `entities.*` method anchors in `advanced/ontology.html` (now use the actual `#jt-*` IDs), the Changeset link in `value/diff.html`, and the Quad / SubjectGroup link in `advanced/quads.html` (latter two had no matching heading; added).

## [0.4.1] - 2026-05-13

### Added

- Bookstore demo (β): new `examples/docs/bookstore/transforms.ts` (Transform.create + Transform.pipe pairwise compatibility), `examples/docs/bookstore/antiPatterns.ts` (Compose brand-error documentation via @ts-expect-error), and `scripts/bookstore-static.ts` (parametrised JsonTology static facade).
- Bookstore demo (α): five new entities (`StockLevel`, `PublicationDate`, `BookAnnotations`, `BookListPage`, `BookCatalogEntry`) and updates to `Book.authors` (uniqueItems), `EBook.fileFormat` (if/then/else), `Quantity` (int32 format brand) to demonstrate bounded multipleOf narrowing, the `date` format brand, patternProperties template-literal expansion, `BaseTypes.page()` factory, embedded-`$id` $ref resolution, `UniqueArrayBrandInterface`, generalised if/then/else inference, and a numeric format brand.
- Bookstore demo (γ): OWL 2 property-characteristic annotations on natural relations — `Review.customerId` (`functional`), `Customer.id` (`inverseFunctional`), `Order.placedAt` (`transitive` + `irreflexive`); new `SimilarBook` entity (`symmetric` + `reflexive`) and `Sequel` entity (`asymmetric`); `ValidateSchemaType<T>` opt-in compile-time self-checks on `OrderSchema` and `ReviewSchema`.

### Fixed

- 0.4.0 doc audit remediation: 11 critical + 17 high findings across `getting-started`, `schemas`, `constraint-brands`, `argument-conventions`, `composition/*`, `advanced/*`, `errors/*`, `migration-0.4.0`, `bookstore-domain`, and `validation-modes`. Fixes: wrong return type for `toQuads` (now correctly `QuadInterface[]`, not `OntologyBuilder`); `value.cast` (not `value.coerce`); brand interface names use the `...Interface` suffix throughout; `Lift.fromQuad` (not `fromRdfQuad`); `subschemaAt` documented as 2-arg; 5 previously-undocumented error codes added (`GRAPH_INVALID_RESTRICTION`, `SCHEMA_DUPLICATE_ID`, `SCHEMA_DUPLICATE_SHAPE`, `TRANSFORM_DECODE_FAILED`, `CYCLIC_DATA`); validation-mode badges corrected for `getDefaults` (Runtime), `complementOf` (split out from group badge), `sameAs` (badge added); bookstore folder layout aligned to actual entities. Two code changes: error-code constants (`SchemaErrorCode`, `GraphErrorCode`, etc.) now publicly exported from `'json-tology'`; `SchemaRefType` now publicly exported from `'json-tology/types'` — both unblock import patterns the docs claim work.

## [0.4.0] - 2026-05-12

### Removed

- `maxDataDepth` option from `JsonTologyOptionsInterface`. Pre-1.0 clean-break: the field was declared and documented but never wired into the execution path. Removed entirely rather than shipped as dead API. The `MaterializationError` `DATA_DEPTH_EXCEEDED` code is removed alongside.

### Changed

- Docs: new "Validation modes" page introducing the `Compile-time` / `Runtime` / `Compile-time + Runtime` badge system; every keyword, brand, and feature in the reference docs is now tagged with its enforcement layer. New / expanded pages cover the 0.4.0 surface: 25 named format brands, uniqueItems tuple distinctness, multipleOf bounded narrowing, full OWL 2 property characteristics, generalised if/then/else inference, patternProperties template-literal expansion, Compose argument validation, schema-validator brands, OWL class-axiom compile-time enforcement, runtime cross-schema $ref strict resolution, GraphEngine self-ref / embedded-$id resolution, and the static-facade parametrization. New migration page covers the 0.4.0 breaking changes (subjectIRI / maxDepth / maxDataDepth / CoercionErrorCodeType removed; make*Schema → BaseTypes.response()/.result()/.page(); Node >= 24).
- Second consolidation pass on the test suite: ~120 additional `it` blocks collapsed into scenario-driven GBU tables across `validation`, `coverageGaps`, `compilerConformance`, `registry`, `hash`, `lift`, `dataTypes`, and `computed`. Total assertion coverage preserved; suite organisation tightened.
- Test-tier corrections: `logger` tests moved smoke → unit; `baseTypes` cross-module registry scenarios moved smoke → integration; `quads` moved integration → unit; `maxSchemaDepth` scenarios moved integration → unit. `beforeEach`/`afterEach` shared-state hooks in `cliWriter` and `logger` tests replaced with per-`it` inline `try`/`finally` fixtures.
- Test suites consolidated into scenario-driven Good/Bad/Ugly tables: total `it` block count reduced ~70% while assertion coverage is preserved. Targets the dataTypes / instantiate / validation / graph / skolemize / sameAs / operations / serialization / quads suites. `compilerConformance` counter moved into a `describe` closure to remove the only test-order dependence in the suite.
- Module-structure cleanup: `BaseTypes` runtime data moved from `src/types/` to `src/modules/data/`; factory functions renamed `make*` → `BaseTypes.response()` / `.result()` / `.page()` per the noun.verb() convention. `RESTRICTION_TAG` constant moved from `src/types/Restriction.ts` to `src/constants/`. XSD type-resolver functions promoted from `src/constants/XSD_MAPS.ts` into a dedicated `XsdTypes` module. `SerializerUtils.ts` folded into `BaseGraphSerializer`.
- Public type surface refinements for 0.4.0: `JsonTology` static facade methods (`dump`, `fromQuads`, `instantiate`, `materialize`) are now generic over the supplied schema and return the inferred type instead of `unknown`; a new `brand<T>()` helper in `src/types/Brand.ts` replaces the 10 ad-hoc `as unknown as` brand projections in `Compose` / `Transform`; `SchemaGraph.nodeForPointer()` / `GraphEngine` `propertyNodeMap`-style helpers replace 7 `Map.get() as Interface` casts with explicit `GraphError('POINTER_NOT_FOUND')` throws.
- **Runtime cross-schema `$ref` resolution is now strict.** Previously, registering a schema whose properties reference an unregistered `$id` succeeded silently, and validation against that schema treated the unresolvable branch as passing. The registry now performs a lazy walk on first use of an entry (the first `validate` / `instantiate` / `materialize` / `createDefault` / `convert` / `cast` / `is` / `clean` against it) and throws `GraphError` with code `REF_UNRESOLVED` if any non-fragment `$ref` points to an IRI that is neither in the registry nor embedded as a nested `$id` within the same schema. Local fragment refs (`#`, `#/foo`, `#anchor`) are unaffected. The check is cached on the entry so the walk runs at most once per schema. This brings runtime parity with the compile-time cross-schema `$ref` check shipped in PR #54 (`InferType` flags the same condition at the type level).

### Fixed

- `GraphEngine.resolveRef` failed to resolve a schema's `$ref` to its own `$id` when the engine was obtained via `registry.engine(schemaObj)` and `.errors(data)` was called directly. The compiled fast-path (`registry.validate`) was unaffected. Now the interpreted path recognises the root schema's own `$id` and resolves self-references consistently with the compiled path, restoring parity. Surfaced by a new compiled/interpreted parity test.
- `GraphEngine.resolveRef` failed to resolve `$ref` targets that pointed at embedded `$id` declarations inside a schema's `$defs` (or any nested sub-schema) when accessed via `registry.engine(schemaObj)`. The engine path now performs the same embedded-id walk on construction and `SchemaRegistry.engine()` extends the `lookupSchema` callback to return embedded sub-schemas, so the compiled validate path and the engine path both resolve embedded `$id` refs and agree on validation results.
- `docs/schemas.md` TypeBox snippets in the "Define and Register a Schema", "Anonymous registration", and "Lookup by `$id` or symbol" sections. The earlier text routed TypeBox through AJV (`import Ajv from 'ajv'; ajv.validate(schema, …)`), which understated TypeBox by ignoring its own runtime. The corrected snippets use `@sinclair/typebox/value` (`import { Value } from '@sinclair/typebox/value'; Value.Check(schema, data)`) and note that `Type.Ref(target)` resolves against a user-maintained `$defs` map at compile time. No behaviour change — comparison-table accuracy only.

### Added

- Test-coverage closures: new suites for `Value` Bad paths, `viz/HtmlRenderer`, `viz/VizDataCollector`. Extended GBU coverage for `Hash` (cycles / BigInt / Symbol keys), `Transform` (encoder/decoder throws / pipe arity / empty pipe), and `Materializer` (cycles / depth / IRI collision / missing skolemizer).
- New `CliWriter` domain module (`src/modules/cli/CliWriter.ts`) owns all CLI stdout/stderr output. Replaces the inline `console.log`/`console.error` calls in `src/cli.ts` with explicit `writer.out()`/`writer.err()`/`writer.exit()` methods, removing the project's only `console.*` call sites and enabling test injection of CLI output.
- Compile-time tuple-distinctness narrowing for `uniqueItems: true`. `InferType<typeof Schema>` now folds `uniqueItems: true` into the inferred type two ways: (1) for homogeneous arrays, the inferred type carries `UniqueArrayBrandInterface<T>` (a generic uniqueness brand parameterised by element type, in `src/types/ConstraintBrands.ts`) so a plain `T[]` cannot satisfy it — values must come through `JsonTology.instantiate` / `coerce` / `materialize`; (2) for literal-typed tuples (≤ 8 elements, declared via `prefixItems`), `UniqueTuplePairwiseType` runs a pairwise overlap check at the type level and collapses the tuple to `never` when any pair of element types overlaps, so `{ prefixItems: [{const:'red'},{const:'red'}], uniqueItems: true }` is a compile-time error. Above the 8-element cap the tuple passes through unchanged and runtime validation still enforces `uniqueItems`. Closes Finding 25 of `designs/0002-total-compile-time-enforcement.md`.
- 25 named format-brand aliases in `src/types/ConstraintBrands.ts` covering the full JSON Schema 2020-12 standard format set plus json-tology built-ins: `EmailBrandInterface`, `IdnEmailBrandInterface`, `UriBrandInterface`, `UriReferenceBrandInterface`, `UriTemplateBrandInterface`, `IriBrandInterface`, `IriReferenceBrandInterface`, `UuidBrandInterface`, `DateBrandInterface`, `DateTimeBrandInterface`, `TimeBrandInterface`, `DurationBrandInterface`, `HostnameBrandInterface`, `IdnHostnameBrandInterface`, `Ipv4BrandInterface`, `Ipv6BrandInterface`, `RegexBrandInterface`, `JsonPointerBrandInterface`, `RelativeJsonPointerBrandInterface`, `BinaryBrandInterface`, `ByteBrandInterface`, `Int32BrandInterface`, `Int64BrandInterface`, `FloatBrandInterface`, `DoubleBrandInterface`. Each alias specialises `FormatBrandInterface<F>` to a single format string so a consumer can write `function send(to: EmailBrandInterface): void` and reject plain `string` arguments at compile time. The brand-first intersection ordering (`FormatBrandInterface<F> & string`) keeps the named brand visible in IDE hovers instead of being hidden behind `string`. Closes Finding 23 of `designs/0002-total-compile-time-enforcement.md`.
- Compile-time test coverage for `multipleOf` bounded-range literal-union narrowing (`test/types/multiple-of-bounded.test.ts`). The narrowing itself (`MultipleOfRangeType<TMin, TMax, TStep>` in `src/types/Infer.ts`) was already wired into the integer-typed branch of `InferType`: when `type: 'integer'` is combined with literal `minimum`, `maximum`, and `multipleOf` and `(max - min) / multipleOf ≤ 50` (the `IntegerRangeCap`), the inferred type is the literal union of in-range multiples (e.g. `{type:'integer',min:0,max:10,multipleOf:2}` → `0|2|4|6|8|10`). Above the cap the type falls through to `number`; bounded integer ranges without `multipleOf` continue to use the existing `IntegerRangeType` path; offset minima emit only multiples within the bounds (e.g. `min:7,max:20,multipleOf:5` → `10|15|20`). Closes Finding 24 of `designs/0002-total-compile-time-enforcement.md`.
- Canonical JSON Schema dialect declaration on every user-facing docs page. `docs/getting-started.md`, `docs/index.md`, `docs/references.md`, and `docs/schemas.md` now state explicitly that json-tology targets **JSON Schema draft 2020-12** (`https://json-schema.org/draft/2020-12/schema`). `docs/references.md` gains a new "Supported dialect" section as the canonical home for the statement; other pages link or echo it. This removes ambiguity for users coming from older drafts and surfaces the IETF JSON Schema Working Group standardization track on the schema page.
- **Full OWL 2 property-characteristic vocabulary.** Five new schema keywords (`asymmetric`, `functional`, `inverseFunctional`, `irreflexive`, `reflexive`) join the existing `symmetric` / `transitive` keywords and round out the OWL 2 property characteristics. Setting a keyword to `true` on a property schema emits the corresponding `rdf:type owl:*Property` quad through the canonical graph and the OWL TBox projection (`GraphOntologySerializer`). The constants `OWL.AsymmetricProperty`, `OWL.FunctionalProperty`, `OWL.InverseFunctionalProperty`, `OWL.IrreflexiveProperty`, `OWL.ReflexiveProperty` (in `src/constants/IRI.ts`) and `RDFS.subPropertyOf` are exposed alongside the keywords; `OWL_CORE_PREDICATES` in `src/constants/ONTOLOGY_PREDICATES.ts` now lists the full set. `SchemaGraphSemanticsInterface` carries each characteristic as a boolean field so consumers can inspect them on the canonical graph without re-reading the source schema. `RelationPredicateType` (`src/types/SchemaGraph.ts`) widens to cover the five new property types.
- Docs: external-references integration. New "Tooling and ecosystem" section in `docs/references.md` covering [sourcemeta/jsonschema](https://github.com/sourcemeta/jsonschema) (peer JSON Schema CLI), the Sourcemeta essay [AI only speaks JSON Schema](https://www.sourcemeta.com/blog/ai-only-speaks-json-schema/) (LLM convergence on JSON Schema as the lingua franca for structured outputs and tool calling), and the [IETF JSON Schema Working Group](https://datatracker.ietf.org/wg/jsonschema/about/) (Proposed Standard track). Inline links from `docs/index.md` (LLM consumer angle in the cross-language interop section), `docs/getting-started.md` (sourcemeta/jsonschema as peer ecosystem tooling), and `docs/schemas.md` (IETF WG as the standardization track for draft-2020-12).
- `ValidateSchemaType<T>` (in `src/types/SchemaValidation.ts`) and structured error brands `RequiredKeyNotInPropertiesInterface`, `DependentRequiredKeyNotInPropertiesInterface`, `IfDiscriminatorNotInPropertiesInterface` (in `src/types/TypeErrors.ts`) — compile-time cross-keyword schema validator for Cluster B of `designs/0002-total-compile-time-enforcement.md` (Findings 7, 8, 9). Catches `required` entries that are not keys of `properties`, `dependentRequired` map keys or value-array entries that are not keys of `properties`, and `if.properties` discriminator keys that are not keys of the parent `properties`. Applied as a parameter constraint inside `Compose.subClassOf`, `Compose.complementOf`, `Compose.disjointWith`, and `Compose.extend` so Compose-built schemas are correct by construction. Hand-written schemas can opt in via `const _ok: ValidateSchemaType<typeof MySchema> = MySchema;`.
- Compile-time argument validation for `Compose.*` builders (Cluster A of `designs/0002-total-compile-time-enforcement.md`):
  - `Compose.pick(schema, keys, newId)` — `keys` are now bound to `keyof properties`; passing a non-existent key is a type error rather than a silent empty-properties result.
  - `Compose.omit(schema, keys, newId)` — same `keyof properties` constraint as `pick`.
  - `Compose.subClassOf(parent, body)` — body's `$id` cannot match the parent's `$id` (or any element's `$id` when the parent is a tuple of schemas). Self-subclass surfaces a `SelfSubClassType` brand error.
  - `Compose.discriminatedUnion(prop, variants, newId)` — every variant must declare `properties[prop]` as `const` and list `prop` in `required`. Missing or non-const discriminators surface a `DiscriminatorMissingType` brand error.
  - `Compose.equivalent(source, options)` — `options.$id` cannot equal `source.$id`; self-equivalent surfaces a `SelfEquivalentType` brand error.
  - `Compose.intersection(schemas, newId)` — `newId` cannot collide with any input schema's `$id`; collision surfaces an `IntersectionIdCollisionType` brand error.
  - The named brand error types live in `src/types/TypeErrors.ts` (alongside Cluster B's validator-result interfaces) so IDE hovers describe the failure rather than reporting a generic "not assignable to never".
- `Compose.someValuesFrom` / `Compose.allValuesFrom` / `Compose.hasValue` / `Compose.cardinality` / `Compose.minCardinality` / `Compose.maxCardinality` — opaque restriction descriptors that compose with `Compose.subClassOf(restriction, body)` to attach OWL property restrictions to a class. The TBox projection emits anonymous `owl:Restriction` blank nodes (`_:b{n} rdf:type owl:Restriction; owl:onProperty <prop>; owl:<predicate> <value>`) linked via `rdfs:subClassOf`. New `Compose.subClassOf` overload accepts a `RestrictionRefType` parent and stores descriptors under the body's `jt:restrictions` annotation.
- `JsonTology.sameAs` — declare ABox identity between two named individuals. `SameAsStore` accumulates the assertions; the OWL ABox projection emits `owl:sameAs` triples in both directions.
- Doc pages: `docs/composition/restrictions.md` (OWL restrictions reference) and `docs/advanced/sameas.md` (sameAs identity reference).
- Bookstore demo extended with seven new entities to exercise every `Compose` class-axiom and OWL restriction: `EBookSchema` (subClassOf), `PrintBookSchema` (subClassOf + disjointWith EBook), `RareBookSchema` (subClassOf PrintBook + someValuesFrom + maxCardinality), `SoloAuthoredBookSchema` (subClassOf Book + cardinality), `AnthologyBookSchema` (subClassOf Book + minCardinality + allValuesFrom), `InPrintBookSchema` (subClassOf Book + hasValue), and `OutOfPrintBookSchema` (complementOf InPrintBook, body `allOf` bounded to Book so the OWL complement is restricted to the Book universe rather than spanning ⊤). The `bookstoreEntities` registry also records an `owl:sameAs` between two customer IRIs.
- `BookstoreGraph` Vue component now reads user-authored restrictions directly from each schema's `jt:restrictions` annotation (one edge per descriptor) instead of walking inlined `owl:Restriction` blank nodes from the OWL projection — that path was emitting auto-derived `minCardinality 1` for every `required` field and `allValuesFrom` for every `items.$ref`, both of which were structural noise. The new path renders six clean edges, one per user-authored restriction, with labels `prop ∃` / `prop ∀` / `prop = literal` / `prop card =N` / `prop card ≥N` / `prop card ≤N`.
- `BookstoreGraph` also gains a navigation pane (zoom in / zoom out / fit-to-view / re-run-layout) docked bottom-right of the container, plus relaxed zoom limits so the user can back out for an overview as well as zoom in to read labels.
- Brand wordmark gradient reshaped to dark → mid → dark (was light → mid → dark) for stronger contrast against both light and dark page backgrounds while staying within the teal family.
- `bookstore-domain.md` rewritten to show the full generating code (one `entities/*.ts` listing per axiom kind) plus a graph-edge legend table — every declaration that produces an edge in the live `BookstoreGraph` is reproduced verbatim, so the docs page is the single reference for what the graph depicts.
- **Compile-time enforcement of OWL class axioms and property restrictions**. `InferType<typeof Schema>` now folds the schema's OWL annotations into the inferred TypeScript type so violations are caught by the compiler, not just at runtime:
  - `disjointWith: X` adds a `~jt:disjointWith` brand naming X. Symmetric declarations (both classes naming each other) make the cross-assignment a type error in either direction; asymmetric declarations cover one direction at compile time and the other at runtime.
  - `not: { $ref: X }` (from `Compose.complementOf`) adds a `~jt:complementOf` brand naming X.
  - `jt:restrictions` (from `Compose.subClassOf(restriction, body)`) narrows the named property's inferred type:
    - `hasValue(prop, V)` → property type is the literal `V`.
    - `cardinality(prop, N)` → property type is a length-`N` readonly tuple (capped at 16).
    - `minCardinality(prop, N)` → non-empty tuple with `N` mandatory prefix elements.
    - `maxCardinality(prop, N)` → union of tuples with length `0..N`.
    - `someValuesFrom(prop, C)` → non-empty tuple of the property's element type.
    - `allValuesFrom(prop, C)` → readonly array of the property's element type.
- Generalised `if/then/else` discriminator inference in `InferType` (Cluster F / Finding 18). Where the existing matcher only recognised single-property `const` discriminators, the new `IfNarrowingObjectType` walks every property in `if.properties` and narrows the `then` branch with the conjunction of three recognised forms: `{ const: V }` → literal `V`, `{ enum: [V, ...] }` → union of the literals, and `{ type: "string" | "number" | ... }` → the corresponding primitive. Multi-property discriminators (`{ kind: { const: "circle" }, color: { const: "red" } }`) intersect all literals at once. Every property in `if.properties` must appear in `required` for the narrowing to apply; otherwise the matcher falls back to the existing union-of-branches over-approximation. Regression test for the original single-const case remains in `test/types/compile-time-constraints.test.ts` and passes unchanged.
- Runtime `disjointWith` enforcement: `SchemaRegistry.validate` runs the disjoint target's compiled validator after the source schema's structural pass and surfaces a `disjointWith` keyword `ValidationError` (with `params.disjointTarget`) if both succeed. Two unit tests cover the violation and negative cases. Layered with the compile-time brand: structural type errors at authoring time, runtime errors at the trust boundary.
- **Compile-time `patternProperties` template-literal expansion** (designs/0002 Cluster G / Finding 19). `PatternToKeyType` in `src/types/Infer.ts` recognises three additional anchored regex shapes:
  - `^(a|b|c)$` → literal union `'a' | 'b' | 'c'` (each branch must be a metacharacter-free literal; otherwise the alternation falls back to `string`).
  - `^[class]+suffix$` / `^[class]*suffix$` → `` `${string}suffix` `` (the character class portion narrows to `string` since TypeScript cannot bind char ranges; the literal suffix survives).
  - `^.{N}$` for `N ≤ 8` → length-`N` character template literal `\`${string}${string}…\``; for `N` above the cap it falls back to `string`.
  Existing `^prefix`, `suffix$`, and `^exact$` handlers are unchanged. Patterns no handler recognises continue to fall through to `string` (no regression). New `test/types/pattern-properties.test.ts` covers each new shape and the fall-through cases.
- **Opt-in `tightStringLengths` narrowing for `minLength` / `maxLength`** (designs/0002 Cluster G / Finding 20). When a project augments `JsonTologyTypeConfigInterface` with `'tightStringLengths': true`, `InferType` narrows strings whose `minLength`/`maxLength` bounds are within `StringLengthCap = 8` to a union of fixed-length character template literals. `minLength === maxLength === N` produces a length-`N` template; `minLength < maxLength` produces a union of templates over the bounded range. Bounds above the cap (or with the flag disabled) fall back to plain `string`. The flag is default-off so existing schemas pay no compile cost; opt in via:
  ```ts
  declare module 'json-tology/types' {
    interface JsonTologyTypeConfigInterface { 'tightStringLengths': true }
  }
  ```
  New `test/types/string-length.test.ts` exercises the enabled path; the disabled-default behaviour is covered by the existing `inference.test.ts`.
- **Auto-applied `IntegerRangeType` for bounded integers** (designs/0002 Cluster G / Finding 21). When `type: 'integer'` is declared with both `minimum` and `maximum` and `maximum ≤ IntegerRangeCap = 50`, `InferType` emits `IntegerRangeType<min, max>` (a literal union) instead of plain `number`. Above the cap, or with only one bound present, the inferred type stays `number`. The previous behaviour silently fell through to `number` whenever the linear tuple builder hit its cap; the new `RangeWithinCapType` makes the cap-gate explicit so above-cap ranges resolve cleanly without partial expansion. New `test/types/integer-range.test.ts` covers `1..5`, `0..10`, `50..50`, `0..1000`, `100..110`, and single-bound cases.
- **Compile-time pairwise chain compatibility for `Transform.pipe`** (designs/0002 Cluster D / Findings 10, 11). `Transform.pipe(schema, [s0, s1, ...])` now enforces stage-to-stage type compatibility at the call site:
  - `TransformStageInterface<TIn, TOut>` (in `src/interfaces/TransformStage.ts`) types each pipe stage's `decode: (TIn) => TOut` and `encode: (TOut) => TIn`. The variance-friendly `AnyTransformStageInterface` upper bound lets generic constraints accept any concrete stage specialisation under strict function types.
  - `ValidatePipeChainType<TStages, TWire>` (in `src/types/Transform.ts`) walks the stage tuple pairwise and replaces incompatible elements with a `PipeChainMismatchInterface<index, produced, expected>` brand. The first stage is also checked against the schema's wire type and replaced with `PipeChainSchemaMismatchInterface<wire, firstStageIn>` on mismatch. Both error brands live in `src/types/TypeErrors.ts` alongside the Cluster B brands. Recursion is capped at 10 stages, matching `TupleRecursionCap`.
  - `PipeChainOutputType<TStages>` extracts the chain's terminal decoded type so `Transform.pipe`'s return value carries the correct `ParseOutputType` brand without manual generic threading.
  - The `pipe` parameter is typed `TStages & ValidatePipeChainType<TStages, InferSchemaType<TSchema>>`. When validation fires, the intersection collapses incompatible positions to `never`, and the user's literal stages are not assignable — the call site is rejected with the offending stage type pointed out by the compiler. New positive + negative type-level tests cover (a) well-typed chains of length 1–4, (b) two-stage pairwise mismatches, (c) three-stage middle-of-chain mismatches, (d) wire-type-vs-first-stage mismatches.
  - Audit of `Transform.encode` (Finding 11): the existing signature on `JsonTology.encode(schema, value)` already constrains `value` to the schema's decoded type via `TransformedType<TSchema, TOut>`. New positive + negative tests pin the contract — passing a wire-form string or an unrelated type to `jt.encode(transformedDateSchema, ...)` fails compilation.
- **Compile-time tuple narrowing for raw `minItems` / `maxItems`** (designs/0002 Cluster C / Finding 17). `InferType` on an array schema now folds raw JSON Schema bounds into the inferred shape, mirroring the OWL `cardinality` / `minCardinality` / `maxCardinality` narrowing path:
  - `minItems === maxItems === N` → `BuildExactTupleType<T, N>` (length exactly `N`).
  - `minItems > 0` with no `maxItems` → `BuildAtLeastTupleType<T, minItems>` (`[T, ..., T, ...T[]]`).
  - `maxItems` with no `minItems` → `BuildAtMostTupleType<T, maxItems>` (union of tuples length `0..maxItems`).
  - `minItems < maxItems` → `BuildBoundedTupleType<T, minItems, maxItems>` (union of tuples length `minItems..maxItems`).
  - Bounds without `items` narrow the tuple shape over an `unknown` element. Cap at `TupleCapType = 16`; bounds at or beyond the cap fall through to `readonly T[]` to keep recursion within TS limits. Existing `BuildFixedTupleType` / `BuildMinTupleType` helpers (length cap 10) in `Infer.ts` are removed in favour of the unified `RestrictionInfer.ts` builders so the OWL and raw paths share one implementation. New `test/types/infer-array-bounds.test.ts` covers exact / min-only / max-only / bounded-range / beyond-cap / no-bounds / raw-without-items cases.
- **Compile-time enforcement for the registry and cross-schema references** (designs/0002 Cluster E / Findings 12-16):
  - **Finding 12** — `JsonTology.create({ schemas: [A, B, ...] })` now brands offending tuple slots with `DuplicateSchemaIdInterface<TId>` (in `src/types/TypeErrors.ts`) when two schemas share an `$id`, so the duplicate IRI is named in editor diagnostics and the call fails to compile.
  - **Finding 13** — `JsonTology.addComputed` and `JsonTology.addInvariant` now take `schemaId: keyof TMap & string`, rejecting unregistered IRIs at compile time. Existing `addInvariant<T>(schemaId, invariant)` call sites continue to work because the data-type generic is preserved.
  - **Finding 14** — `JsonTology.findDuplicates()` (a new typed facade over `registry.findDuplicates()`) returns `readonly DuplicateReportEntryType<keyof TMap & string>[]`. The underlying `DuplicateReportEntryType` interface gained an optional `TEquivalentTo extends string = string` parameter so the literal-IRI variant is opt-in and the existing untyped call site is unchanged.
  - **Finding 15** — `InferType<S, TReferences>` now resolves an absolute `$ref` whose IRI is missing from a non-empty `TReferences` map to `RefNotFoundInterface<TRef>` (in `src/types/TypeErrors.ts`) instead of silent `unknown`. With no references map in scope (`Record<never, never>`) the historical `unknown` fallback is preserved, so non-registry consumers are unaffected.
  - **Finding 16** — Cross-schema fragment refs (`<base>#<anchor>`) emit `RefNotFoundInterface<base>` when the base IRI is absent and `AnchorNotFoundInterface<base, anchor>` when the base resolves but the anchor / `$defs` / pointer fragment doesn't. Local `#anchor` refs against the root schema are unchanged.
  - New `test/types/cross-schema-resolution.test.ts` covers Findings 15 / 16 (positive resolution, missing base, missing anchor, missing pointer, no-references-map fallback). `test/types/registry-inference.test.ts` extended with Findings 12 / 13 / 14 positive + `@ts-expect-error` negative cases.

### Changed

- Bumped TypeScript to 6.0 (was 5.9). Required adding explicit `types: ["node"]` to `tsconfig.json` so node built-in modules resolve under the new default. Code paths that previously relied on `as unknown as Foo` casts in places where TS5 still required a hint now use direct assignment — the casts were dead weight under TS6's improved inference.
- Bumped `@rdfjs/types` to 2.0 (was 1.1). Compatible at our consumption surface; eyereasoner's peer pins `@rdfjs/types@^1.1.0`, but its actual usage is purely consuming the existing interfaces v2 retains, so the resolution is sound.
- ESLint ecosystem refresh: `@typescript-eslint/eslint-plugin` 8.59, `eslint` 10.3, `eslint-plugin-perfectionist` 5.9, `eslint-plugin-unicorn` 64. The unicorn 64 `consistent-function-scoping` rule surfaced two test-file factory closures whose inner arrow function was hoistable; refactored to top-level `*Impl` constants returned by the factory.
- GitHub Actions ecosystem refresh: `actions/setup-node@v6`, `actions/upload-artifact@v7`, `actions/github-script@v9`, `actions/deploy-pages@v5`, `actions/configure-pages@v6`. All on Node 24 runtime to match `engines.node >=24.0.0`.
- Minor/patch dependency refresh: `@sinclair/typebox` 0.34.49, `ajv` 8.20, `eyereasoner` 21.1, `vitepress-sidebar` 1.33.2, `zod` 4.4, `globals` 17.6.

## [0.3.3] - 2026-05-05

### Fixed

- README node-row image URLs were relative (`public/...`), which broke on the GitHub Packages page and any other surface that renders the published README without the repo's `public/` folder mounted. Switched to absolute `raw.githubusercontent.com` URLs.

## [0.3.2] - 2026-05-05

### Fixed

- Docs site: live Cytoscape graph failed to load on the deployed Pages site with `Failed to resolve module specifier 'cytoscape'`. The VitePress config previously declared `cytoscape` and `cytoscape-fcose` as Rollup externals, leaving them as bare specifiers in the browser bundle. Removed the externals so they bundle into the asset chunks.
- Docs site: theme defaulted to dark on first load. Set `appearance: false` to make light the default.
- Docs site: dead link to `/errors` from `docs/errors/classes.md` now points at `/errors/`.

## [0.3.1] - 2026-05-05

### Added

- New doc pages covering previously undocumented surface: `docs/advanced/quads.md` (RDF round-trip via `toQuads`/`fromQuads`), `docs/schemas/jt-keywords.md` (`jt:alias`/`jt:computed`/`jt:config`/`jt:frozen`/`jt:strict`), `docs/errors/classes.md` (full error class hierarchy), `docs/static-helpers.md` (the 13 `JsonTology.<op>` static counterparts), `docs/advanced/utilities.md` (`Curie`, `Path`, `Resolver`, `Hash`, `Lift`), `docs/advanced/sub-schemas.md` (`$ref` composition through validation, defaults, coercion, TBox, cycles).
- New "Usage Examples" sidebar section with `docs/usage-examples/custom-formats.md` (custom format validators) and `docs/usage-examples/transforms-recipes.md` (date-time, money, identifiers, encoded payloads, collections, branded types, round-trip discipline).

### Fixed

- Docs: hallucination sweep against `src/`. `validate()` is now correctly described as returning `ValidationErrors` (not `string[]`) across every consuming page. Removed references to non-existent `entities.errors()` / `JsonTology.coerce`. `Value.cast/clean/convert` correctly documented as throwing `CoercionError`. `materializer` option type corrected to `MaterializerOptionsInterface`. `Compose.intersection` argument-order rule fixed to `(sources, newId, extras?)`. `Compose.extend` Declaration rewritten to describe `allOf + $ref` emission. `enableDebug` row added to the options table. `Compose.equivalent` row added to composition index. Circular self-import in the getting-started bookstore snippet removed.
- README replaced with a thin link page pointing at the published GitHub Pages docs.
- CI: every workflow runner bumped to Node 24 to match `engines.node >=24.0.0`. The previous Node 22 runners caused type-aware ESLint plugins to fail to resolve types in `bench/*` files.
- bench imports case-corrected (`schemaRegistry.js` -> `SchemaRegistry.js` etc.) so the type-aware lint pass succeeds on case-sensitive filesystems.
- VitePress `base: '/json-tology/'` set; `BookstoreGraph.vue` data fetches base-prefixed via `import.meta.env.BASE_URL` so the live graph loads under the project Pages prefix.

### Changed

- Sidebar section "Cookbook" renamed to "Usage Examples". Routes `/cookbook/*` -> `/usage-examples/*`.
- `.enginseer/topology/` artifacts (>680K lines) untracked; added to `.gitignore`.

## [0.3.0] - 2026-05-04

### Added

- `JsonTology.subschemaAt(schema, pointer)` - resolves a sub-schema at a JSON Pointer path and returns a registerable schema object with a synthesized `$id`. Composes with all four core methods.
- `SchemaRefType` - universal schema reference type: every method now accepts both a string `$id` and a schema object with `$id`.
- Static counterparts for all 13 instance methods: `JsonTology.is`, `JsonTology.validate`, `JsonTology.instantiate`, `JsonTology.materialize`, `JsonTology.subschemaAt`, `JsonTology.dump`, `JsonTology.dumpJson`, `JsonTology.toQuads`, `JsonTology.fromQuads`, `JsonTology.toSchema`, `JsonTology.toTbox`, `JsonTology.toShacl`, `JsonTology.ontology`. Each creates an ephemeral registry for one-shot execution with no shared state.
- `InstantiationErrorCode` constant exported from `json-tology/constants`.
- `AggregateViewType` named export from `json-tology/types` - typed return value of `ValidationErrors.aggregate()`.
- New doc pages: `docs/picking-a-method.md`, `docs/argument-conventions.md`.

### Changed

- Docs: full polish pass across all 50+ pages. Em-dashes and en-dashes removed and replaced with direct prose equivalents. AI-isms (leverage, robust, seamlessly, note that, etc.) replaced with factual prose. Comparator code-group blocks updated to show workaround attempts with explicit Limitation notes where a library cannot fully support the concept. Related and See also sections added to every operator page. Homepage switched from layout: home to layout: doc with HomeFeaturesHero component, making the sidebar visible on the landing page.

### BREAKING

- `JsonTology.coerce()` renamed to `JsonTology.instantiate()` - the trust-boundary naming axis. `coerce` → `instantiate` at every call site including `value.coerce()` → `value.instantiate()` and registry-level `registry.coerce()` → `registry.instantiate()`.
- `CoercionError` renamed to `InstantiationError` - update all `instanceof CoercionError` checks and `import { CoercionError }` imports to `InstantiationError`. Error code changes from `COERCION_FAILED` to `INSTANTIATION_FAILED`.
- `CoercionErrorCodeType` renamed to `InstantiationErrorCodeType`; `CoercionErrorCode` constant renamed to `InstantiationErrorCode`. Update all constant references.
- `JsonTology.validateAt()` removed - replaced by `JsonTology.subschemaAt(schema, pointer)` which returns a sub-schema object. Compose with `validate()`, `is()`, `instantiate()`, or `materialize()` as needed.
- `materialize()` now validates by default and throws `MaterializationError` on validation failure. Pass `{ enablePartial: true }` to restore lenient construction that allows missing required-without-default fields.
- `SchemaRegistry.validateAt()` removed - replaced by `SchemaRegistry.subschemaAt(schema, pointer)`.

### Changed

- Bookstore example: `PersonName` renamed to `CustomerName` - `urn:bookstore:CustomerName` is the canonical name/string primitive used by `Customer`. Callers importing `PersonNameSchema` must update to `CustomerNameSchema`.
- Bookstore example: `AuthorName` refactored to `Compose.equivalent(CustomerNameSchema, ...)` - same compiled validator, separate domain concept, `owl:equivalentClass` arc in the TBox.
- Bookstore example: `Money` restored as a composite object schema (`{ amount: Amount, currency: CurrencyCode }`) instead of a bare number; `Book.price` and `OrderLine.unitPrice` now accept `{ amount, currency }` objects. Callers passing a plain number must update to `{ amount: <number>, currency: '<code>' }`.
- Bookstore example: `Order` gains required `shippingAddress` property (`$ref: Address`); `currency` property removed from both `Book` and `Order` (currency is now carried inside each `Money` value).
- Docs: BookstoreGraph component now generates Cytoscape elements at runtime from the live bookstore registry - no `fetch()` calls, no static JSON files. `docs/public/data/bookstore-graph.json` and `docs/public/data/bookstore-schemas.json` deleted.
- Docs: `docs/.vitepress/theme/utils/bookstoreGraphData.ts` added as single source for graph derivation - exports `toCytoscapeElements()`, `toJsonLd()`, `toSchemaMap()`; both the Vue component and the WebVOWL build script consume it.
- Docs: `scripts/build-bookstore-graph.mjs` replaced by `scripts/build-bookstore-tbox.mjs` (narrower scope: writes only `docs/public/data/bookstore-tbox.jsonld` for WebVOWL).
- Docs: `npm run build:bookstore-graph` replaced by `npm run build:bookstore-tbox`; `docs:build` updated accordingly.
- Docs homepage (`docs/index.md`): "Advanced usages" section added below the hero features, embedding `<BookstoreGraph />` as a live teaser with links to the full guide and WebVOWL page.

### Changed

- Docs: full polish pass across all 50+ pages. Em-dashes and en-dashes removed and replaced with direct prose equivalents. AI-isms (leverage, robust, seamlessly, note that, etc.) replaced with factual prose. Comparator code-group blocks updated to show workaround attempts with explicit Limitation notes where a library cannot fully support the concept. Related and See also sections added to every operator page. Homepage switched from layout: home to layout: doc with HomeFeaturesHero component, making the sidebar visible on the landing page.

### BREAKING (prior)

- `JsonTology.validate()` return type changed from `string[]` to `ValidationErrors`. Update call sites that compared to `[]` (use `.ok` or `.length === 0`), iterated as strings (use `.items.map(e => e.message)`), or called array methods like `.slice()` (use `.items.slice()`).
- `JsonTology.errors()` removed - replaced by `JsonTology.validate()` which now returns `ValidationErrors`. Rename all `jt.errors(schema, data)` calls to `jt.validate(schema, data)`.
- `ValidationErrors.messages()` removed - recipe: `errs.items.map(e => \`${e.path || 'root'}: ${e.message}\`)`
- `ValidationErrors.format()` removed - recipe: build a `Record<string, ValidationErrorType[]>` by iterating `errs.items` and grouping by `err.path || '_root'`
- `ValidationErrors.flatten()` removed - recipe: split `errs.items` into `fieldErrors` (items where `err.path` is non-empty) and `formErrors` (items where `err.path` is empty)
- `ValidationErrors.aggregate().paths` now returns access form (`items[0].quantity`) instead of JSON Pointer (`/items/0/quantity`). Use `errs.items.map(e => e.path)` for JSON Pointer paths.
- `JsonTologyOptionsInterface.castTypes` renamed to `enableTypeCast`. Update `JsonTology.create({ castTypes: true })` to `JsonTology.create({ enableTypeCast: true })`.
- `JsonTologyOptionsInterface.strict` renamed to `enableStrictTypes`. Update `JsonTology.create({ strict: true })` to `JsonTology.create({ enableStrictTypes: true })`.
- `RegistryOptionsInterface.castTypes` renamed to `enableTypeCast`.
- `RegistryOptionsInterface.strict` renamed to `enableStrictTypes`.
- `bookstoreJt` export from `examples/docs/bookstore/index.ts` renamed to `bookstoreEntities`. Import with `import { bookstoreEntities as entities } from ...` to use the `entities` variable convention.
- `docs/current-state.md` removed - stale snapshot page; use CHANGELOG and CI for current status.
- `docs/architecture-plan.md` moved to `ARCHITECTURE.md` at project root - contributor reference, not user-facing docs. Sidebar entry dropped.

### Added

- `Resolver` static class (`src/modules/data/Resolver.ts`) - `Resolver.merge(base, override)` for per-call option merging; defined values in `override` win over `base`
- `Path` static class (`src/modules/data/Path.ts`) - `Path.toAccess(jsonPointer)` converts JSON Pointer to access form (`/items/0/qty` → `items[0].qty`)
- `enableDebug` option on `JsonTologyOptionsInterface` - schema trace in error messages, `schemaTrace` field on `ValidationErrorType` items, `CoercionError.cause.input` preservation, `logger.debug` events, and cycle-detection diagnostics
- `ARCHITECTURE.md` at project root - internal development plan for contributors

- Docs: new page `docs/advanced/graph-concepts.md` - conceptual coverage of the graph model including TBox vs ABox, open-world assumption, subClassOf/equivalentClass semantics, JSON Pointer identifiers, domain/range, $ref resolution, the serializer trio, ABox projection, $id IRI conventions, SPARQL query patterns, and the irreducible `jt:*` predicate set
- Docs: new page `docs/advanced/graph-demo.md` - interactive Cytoscape force-directed graph of the bookstore TBox with node click-to-inspect panel; graceful JSON-LD fallback if Cytoscape fails to load
- `scripts/build-bookstore-graph.mjs` - build-time data generator that runs `bookstoreJt.toTbox().raw()` and writes `docs/.vitepress/data/bookstore-graph.json` (Cytoscape elements) and `docs/.vitepress/data/bookstore-schemas.json` (schema literals); integrated as `npm run build:bookstore-graph` and as a pre-step in `npm run docs:build`
- `docs/.vitepress/theme/components/BookstoreGraph.vue` - Vue 3 SFC with Cytoscape and cytoscape-fcose; client-only dynamic import; per-kind node/edge styling; click-to-inspect side panel; SSR-safe
- `cytoscape` and `cytoscape-fcose` added as devDependencies (docs tooling only; excluded from npm tarball)
- `test/unit/xsdDatatypePrecision.test.ts` - 10 new unit tests verifying that `format: 'date'` → `xsd:date`, `format: 'date-time'` → `xsd:dateTime`, `format: 'uri'` → `xsd:anyURI`, `format: 'duration'` → `xsd:duration` in both OWL TBox (`rdfs:range`) and SHACL (`sh:datatype`) output, and that `format: 'email'` stays `xsd:string`
- `JsonTology.toTbox()` - returns a fresh `OntologyBuilder` containing only the OWL TBox (class declarations, property declarations, domain/range assertions, cardinality) derived from all registered schemas; symmetric with `toQuads()` (ABox); not cached
- `JsonTology.toShacl()` - returns a fresh `OntologyBuilder` containing only the SHACL shapes (node shapes, property shapes) derived from all registered schemas; not cached
- Bookstore example refactored to graph-native, ontologically-correct shape: 17 primitive schemas and 6 entity schemas each in their own file under `examples/docs/bookstore/entities/`; `urn:bookstore:{PascalCase}` IRI pattern; every `$ref` uses `SourceSchema.$id` with an explicit named import; orchestrator at `examples/docs/bookstore/index.ts` registers all schemas and re-exports them; `docs/bookstore-domain.md` updated with folder-layout section and `$ref`-traceable code blocks

- `enableInlineWarnings` option on `JsonTology.create()` and `SchemaRegistry` - surfaces inline-object, inline-primitive, and inline-array-items warnings via `logger.warn` at registration time; default `false`
- `enableDuplicateDetection` option - runs `SchemaRegistry.findDuplicates()` automatically at registration and emits `logger.warn` on structural duplicates; default `false`
- `enableStrictGraph` option - promotes inline warnings and duplicate detection to `SchemaError` throws at registration; every sub-schema must be a standalone `$id` schema or `$defs` entry; implies `enableInlineWarnings` and `enableDuplicateDetection`; default `false`
- `enableDefaults` option on `JsonTology.create()` and `SchemaRegistry` - controls whether `coerce()` fills schema `default` values; default `true` (existing behavior); per-call override via third argument `coerce(schema, data, { enableDefaults: false })`
- `SchemaRegistry.findDuplicates()` - on-demand structural-hash duplicate check; returns array of `{ schemaId, pointer, equivalentTo, shape }` entries; also accessible via `jt.registry.findDuplicates()`
- `Compose.equivalent(source, options)` - creates a thin `$ref` alias for domain-distinct naming without structural duplication; OWL TBox emits `owl:equivalentClass` for the two schemas
- `Compose.extend()` now emits `allOf + $ref` shape (parent referenced via `$ref`, additions as second `allOf` member with `type: object`); preserves compile-time merged type via `ExtendSchemaType`; maps to `rdfs:subClassOf` in the graph; parent schema must be registered before child
- `StructuralHash` static class in `src/modules/data/StructuralHash.ts` - deterministic structural hash that strips metadata fields (title, description, $id) for equivalence comparison
- `inline-primitive` graph warning - fires when a leaf primitive schema with constraint keywords (pattern, format, minimum, enum, etc.) is declared inline without `$id` and not under `$defs`
- `inline-array-items` graph warning - fires when an array's `items` schema carries constraint keywords inline without `$id`
- `SCHEMA_DUPLICATE_SHAPE` error code for strict-mode duplicate detection throws
- Docs: new page `docs/advanced/graph-native-authoring.md` covering inline duplication, named primitives, `Compose.equivalent`, `Compose.extend` allOf+$ref semantics, `findDuplicates()`, and all three enforcement flags; sidebar updated
- New runnable examples: `examples/docs/advanced/04-find-duplicates.ts`, `05-equivalent.ts`, `06-strict-graph-mode.ts`
- `JsonTology.toTbox()` - returns a fresh `OntologyBuilder` containing only the OWL TBox (class declarations, property declarations, domain/range assertions, cardinality) derived from all registered schemas; symmetric with `toQuads()` (ABox); not cached
- `JsonTology.toShacl()` - returns a fresh `OntologyBuilder` containing only the SHACL shapes (node shapes, property shapes) derived from all registered schemas; not cached
- Docs: restructured `docs/types.md` Utility Types section - each of the eight utility types (`DeprecatedKeysType`, `NonDeprecatedSchemaType`, `LooseInputType`, `EnumValuesType`, `ExhaustiveType`, `DefaultAlignedType`, `IntegerRangeType`, `MultipleOfRangeType`) now has its own H2 section with Declaration, Use this when, Don't use this when, Signature, Examples (bookstore domain), Bad examples, Comparison (Zod/TypeBox/AJV/Pydantic), Related, and See also; sidebar updated with per-type anchor links
- `jt:strict` keyword for per-field strict type enforcement - prevents coercion (string→number, truthy→boolean, etc.) on individual properties; `jt:strict: false` opts a field out when `jt:config.strict` is `true`
- `jt:frozen` keyword on object schemas - `coerce()` and `materialize()` return deeply-frozen values (all nested objects and arrays frozen); mutation throws in strict-mode ESM modules
- `jt:config` keyword for schema-level defaults - `strict` (default strict for all fields), `frozen` (shorthand for jt:frozen), and `extra` (`'ignore'` | `'allow'` | `'forbid'`) for unknown property handling
- `EXTRA_FORBIDDEN` error code for `jt:config.extra: 'forbid'` validation errors
- `JtConfigType` and `JtExtraType` exported from `json-tology/types`
- `Compose.extend()` merges `jt:config` keys - child wins per key; `pick()`/`omit()` carry `jt:config` unchanged
- `jtConfig`, `jtFrozen`, `jtStrict` fields on `SchemaGraphSemanticsInterface` for serializer and visualization use


- Docs rewrite: per-operator pages under `docs/validation/`, `docs/composition/`, `docs/transforms/`, `docs/value/`, `docs/errors/`, `docs/serialization/`, `docs/registry/`, `docs/advanced/`; bookstore eCommerce running domain (`docs/bookstore-domain.md`, `docs/_examples/bookstore.md`); per-operator section template (Declaration / Use this when / Don't use this when / Examples / Bad examples / Comparison / Related / See also); Zod/TypeBox/AJV/Pydantic comparison tabs on every operator; runnable examples under `examples/docs/` with smoke test in `test/smoke/docExamples.test.ts`; new sidebar in `docs/.vitepress/config.ts` with per-operator entries
- `dump(schemaId, value, options?)` on `JsonTology` - Pydantic-equivalent serializer that walks the canonical graph, applies `Transform` encoders, and supports `exclude`, `include`, `excludeUnset`, `excludeDefaults`, and `mode` ('wire' | 'json') options
- `dumpJson(schemaId, value, options?)` on `JsonTology` - convenience wrapper around `dump()` with `mode: 'json'` that returns a `JSON.stringify`-ready string
- `DumpOptionsInterface` in `src/interfaces/Dump.ts`, re-exported from `json-tology/interfaces`
- Cross-field invariant support (InvariantInterface, InvariantFnType) - register imperative post-validation checks via JsonTology.create({ invariants }), jt.addInvariant(), and jt.removeInvariant(). Invariants run after structural validation succeeds and append jt:invariant-keyed errors to errors(), throw CoercionError from coerce(), and return false from is().
- `jt:computed` keyword for Pydantic-parity computed fields: properties derived at coerce/materialize time from registered compute functions
- `ComputedStore` in `src/modules/registry/ComputedStore.ts` - mutable store for per-schema compute functions
- `computeds` option on `JsonTology.create()` and `JsonTologyOptionsInterface` for construction-time function registration
- `JsonTology.addComputed()` and `JsonTology.removeComputed()` for runtime compute function management
- `ComputedFnType` in `src/types/Computed.ts`
- `COMPUTED_INPUT_FORBIDDEN` and `COMPUTED_FN_MISSING` error codes
- Computed property `computed: boolean` flag on `SchemaGraphSemanticsInterface` for serializer and visualization use
- `jt:alias` keyword for Pydantic-equivalent field aliases - a schema property may declare a single alias string or a list of alias strings; `coerce()` maps alias input keys to the canonical key before validation and normalization
- `ValidationErrors.aggregate()` - compact rollup `{ count, paths, keywords }` for structured logging and metric labels (deduplicated, sorted, no unbounded `params` values)
- `ValidationErrors.report()` - RFC 7807 Problem Details payload for HTTP `422` error response bodies; accepts partial overrides for `instance`, `status`, `title`, and `type`
- `ProblemDetailsType` exported from `json-tology/types`

## [0.2.0] - 2026-05-03

### Added
- `jt:strict` keyword for per-field strict type enforcement - prevents coercion (string→number, truthy→boolean, etc.) on individual properties; `jt:strict: false` opts a field out when `jt:config.strict` is `true`
- `jt:frozen` keyword on object schemas - `coerce()` and `materialize()` return deeply-frozen values (all nested objects and arrays frozen); mutation throws in strict-mode ESM modules
- `jt:config` keyword for schema-level defaults - `strict` (default strict for all fields), `frozen` (shorthand for jt:frozen), and `extra` (`'ignore'` | `'allow'` | `'forbid'`) for unknown property handling
- `EXTRA_FORBIDDEN` error code for `jt:config.extra: 'forbid'` validation errors
- `JtConfigType` and `JtExtraType` exported from `json-tology/types`
- `Compose.extend()` merges `jt:config` keys - child wins per key; `pick()`/`omit()` carry `jt:config` unchanged
- `jtConfig`, `jtFrozen`, `jtStrict` fields on `SchemaGraphSemanticsInterface` for serializer and visualization use


- Vocabulary plugin system (`VocabularyPluginInterface`) for extensible custom RDF vocabularies
- `vocabularies` option on `JsonTology.create()`, `SchemaRegistry`, and serializer constructors
- CURIE expansion pipeline - all RDF projections now emit full IRIs instead of CURIE shortcuts
- `Curie` class and `CurieInterface` for compact URI expansion and compaction
- Serializer constructors (`GraphOntologySerializer`, `GraphShaclSerializer`) accept optional `CurieInterface` and `VocabularyPluginInterface[]`
- DCAT-AP 3.0.0 e2e test coverage - 20 entity schemas with property-by-property graph comparison against official W3C SHACL and OWL
- `toQuads()` / `fromQuads()` symmetric pair on `JsonTology` - project objects to RDF quads and lift quads back to typed objects
- `encode()` method on `JsonTology` - encode decoded value to wire representation
- `json-tology/viz` package export - `HtmlRenderer`, `TypeStringEmitter`, visualization types
- `rdfs:domain` and `rdfs:range` annotations accepted in both CURIE and full IRI forms in authored schemas
- Extended semantic predicates: `disjointWith`, `equivalentTo`, `inverseOf`, `transitive`, `symmetric`
- `commander`-based CLI replacing the hand-rolled parser
- `VocabProjection` base class consolidating shared conditional projection logic

### Changed

- JSON-LD output now uses full IRI keys (e.g. `http://www.w3.org/ns/shacl#property`) instead of CURIE shortcuts (`sh:property`)
- `dash:readOnly`/`dash:writeOnly` replace `jsonschema:readOnly`/`jsonschema:writeOnly` in OWL output
- Default prefixes expanded to include `sh`, `dct`, `dcat`, `foaf`, `skos`, `dash`, `prov`, `vann`, `schema`
- `abox()` renamed to `toQuads()` - symmetric with `fromQuads()`
- All module files renamed to PascalCase for consistency
- Test files realigned 1:1 with source modules
- Predicate dispatch consolidated to data-driven tables; `emitConstraintLiteral` extracted
- Canonical imports enforced; dead code removed; options-object call style normalized
- `SchemaIri` and `QuadFactory` converted to idiomatic static-method classes
- Logic relocated to domain modules that own the concepts

## [0.1.0] - 2026-03-10

### Added
- `jt:strict` keyword for per-field strict type enforcement - prevents coercion (string→number, truthy→boolean, etc.) on individual properties; `jt:strict: false` opts a field out when `jt:config.strict` is `true`
- `jt:frozen` keyword on object schemas - `coerce()` and `materialize()` return deeply-frozen values (all nested objects and arrays frozen); mutation throws in strict-mode ESM modules
- `jt:config` keyword for schema-level defaults - `strict` (default strict for all fields), `frozen` (shorthand for jt:frozen), and `extra` (`'ignore'` | `'allow'` | `'forbid'`) for unknown property handling
- `EXTRA_FORBIDDEN` error code for `jt:config.extra: 'forbid'` validation errors
- `JtConfigType` and `JtExtraType` exported from `json-tology/types`
- `Compose.extend()` merges `jt:config` keys - child wins per key; `pick()`/`omit()` carry `jt:config` unchanged
- `jtConfig`, `jtFrozen`, `jtStrict` fields on `SchemaGraphSemanticsInterface` for serializer and visualization use


- JIT schema compiler (`Compiler`) generating inlined per-schema check/errors/normalize/normalizeAndCheck functions
- `Value.parse` single-pass normalize+validate pipeline via `normalizeAndCheck`
- `Value.convert`, `Value.clean`, `Value.diff`, `Value.hash`, `Value.clone` utilities
- `Transform.pipe` for composing schema transforms
- `SchemaRegistry` with JIT fast-path and AJV fallback
- `SchemaOntologyDeriver` for semantic web output
- Benchmark suite vs TypeBox - 1.08-9.56x faster across all operations

### Changed

### Deprecated

### Removed

### Fixed

### Security

[Unreleased]: https://github.com/Studnicky/json-tology/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Studnicky/json-tology/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/Studnicky/json-tology/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Studnicky/json-tology/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Studnicky/json-tology/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Studnicky/json-tology/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Studnicky/json-tology/compare/v0.1.0...v0.2.0
