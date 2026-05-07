# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `Compose.someValuesFrom` / `Compose.allValuesFrom` / `Compose.hasValue` / `Compose.cardinality` / `Compose.minCardinality` / `Compose.maxCardinality` — opaque restriction descriptors that compose with `Compose.subClassOf(restriction, body)` to attach OWL property restrictions to a class. The TBox projection emits anonymous `owl:Restriction` blank nodes (`_:b{n} rdf:type owl:Restriction; owl:onProperty <prop>; owl:<predicate> <value>`) linked via `rdfs:subClassOf`. New `Compose.subClassOf` overload accepts a `RestrictionRefType` parent and stores descriptors under the body's `jt:restrictions` annotation.
- `JsonTology.sameAs` — declare ABox identity between two named individuals. `SameAsStore` accumulates the assertions; the OWL ABox projection emits `owl:sameAs` triples in both directions.
- Doc pages: `docs/composition/restrictions.md` (OWL restrictions reference) and `docs/advanced/sameas.md` (sameAs identity reference).

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

[Unreleased]: https://github.com/Studnicky/json-tology/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/Studnicky/json-tology/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Studnicky/json-tology/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Studnicky/json-tology/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Studnicky/json-tology/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Studnicky/json-tology/compare/v0.1.0...v0.2.0
