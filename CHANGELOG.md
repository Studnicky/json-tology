# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Docs: new page `docs/advanced/graph-concepts.md` — conceptual coverage of the graph model including TBox vs ABox, open-world assumption, subClassOf/equivalentClass semantics, JSON Pointer identifiers, domain/range, $ref resolution, the serializer trio, ABox projection, $id IRI conventions, SPARQL query patterns, and the irreducible `jt:*` predicate set
- Docs: new page `docs/advanced/graph-demo.md` — interactive Cytoscape force-directed graph of the bookstore TBox with node click-to-inspect panel; graceful JSON-LD fallback if Cytoscape fails to load
- `scripts/build-bookstore-graph.mjs` — build-time data generator that runs `bookstoreJt.toTbox().raw()` and writes `docs/.vitepress/data/bookstore-graph.json` (Cytoscape elements) and `docs/.vitepress/data/bookstore-schemas.json` (schema literals); integrated as `npm run build:bookstore-graph` and as a pre-step in `npm run docs:build`
- `docs/.vitepress/theme/components/BookstoreGraph.vue` — Vue 3 SFC with Cytoscape and cytoscape-fcose; client-only dynamic import; per-kind node/edge styling; click-to-inspect side panel; SSR-safe
- `cytoscape` and `cytoscape-fcose` added as devDependencies (docs tooling only; excluded from npm tarball)
- `test/unit/xsdDatatypePrecision.test.ts` — 10 new unit tests verifying that `format: 'date'` → `xsd:date`, `format: 'date-time'` → `xsd:dateTime`, `format: 'uri'` → `xsd:anyURI`, `format: 'duration'` → `xsd:duration` in both OWL TBox (`rdfs:range`) and SHACL (`sh:datatype`) output, and that `format: 'email'` stays `xsd:string`
- `JsonTology.toTbox()` — returns a fresh `OntologyBuilder` containing only the OWL TBox (class declarations, property declarations, domain/range assertions, cardinality) derived from all registered schemas; symmetric with `toQuads()` (ABox); not cached
- `JsonTology.toShacl()` — returns a fresh `OntologyBuilder` containing only the SHACL shapes (node shapes, property shapes) derived from all registered schemas; not cached
- Bookstore example refactored to graph-native, ontologically-correct shape: 17 primitive schemas and 6 entity schemas each in their own file under `examples/docs/bookstore/entities/`; `urn:bookstore:{PascalCase}` IRI pattern; every `$ref` uses `SourceSchema.$id` with an explicit named import; orchestrator at `examples/docs/bookstore/index.ts` registers all schemas and re-exports them; `docs/bookstore-domain.md` updated with folder-layout section and `$ref`-traceable code blocks

- `enableInlineWarnings` option on `JsonTology.create()` and `SchemaRegistry` — surfaces inline-object, inline-primitive, and inline-array-items warnings via `logger.warn` at registration time; default `false`
- `enableDuplicateDetection` option — runs `SchemaRegistry.findDuplicates()` automatically at registration and emits `logger.warn` on structural duplicates; default `false`
- `enableStrictGraph` option — promotes inline warnings and duplicate detection to `SchemaError` throws at registration; every sub-schema must be a standalone `$id` schema or `$defs` entry; implies `enableInlineWarnings` and `enableDuplicateDetection`; default `false`
- `enableDefaults` option on `JsonTology.create()` and `SchemaRegistry` — controls whether `coerce()` fills schema `default` values; default `true` (existing behavior); per-call override via third argument `coerce(schema, data, { enableDefaults: false })`
- `SchemaRegistry.findDuplicates()` — on-demand structural-hash duplicate check; returns array of `{ schemaId, pointer, equivalentTo, shape }` entries; also accessible via `jt.registry.findDuplicates()`
- `Compose.equivalent(source, options)` — creates a thin `$ref` alias for domain-distinct naming without structural duplication; OWL TBox emits `owl:equivalentClass` for the two schemas
- `Compose.extend()` now emits `allOf + $ref` shape (parent referenced via `$ref`, additions as second `allOf` member with `type: object`); preserves compile-time merged type via `ExtendSchemaType`; maps to `rdfs:subClassOf` in the graph; parent schema must be registered before child
- `StructuralHash` static class in `src/modules/data/StructuralHash.ts` — deterministic structural hash that strips metadata fields (title, description, $id) for equivalence comparison
- `inline-primitive` graph warning — fires when a leaf primitive schema with constraint keywords (pattern, format, minimum, enum, etc.) is declared inline without `$id` and not under `$defs`
- `inline-array-items` graph warning — fires when an array's `items` schema carries constraint keywords inline without `$id`
- `SCHEMA_DUPLICATE_SHAPE` error code for strict-mode duplicate detection throws
- Docs: new page `docs/advanced/graph-native-authoring.md` covering inline duplication, named primitives, `Compose.equivalent`, `Compose.extend` allOf+$ref semantics, `findDuplicates()`, and all three enforcement flags; sidebar updated
- New runnable examples: `examples/docs/advanced/04-find-duplicates.ts`, `05-equivalent.ts`, `06-strict-graph-mode.ts`
- `JsonTology.toTbox()` — returns a fresh `OntologyBuilder` containing only the OWL TBox (class declarations, property declarations, domain/range assertions, cardinality) derived from all registered schemas; symmetric with `toQuads()` (ABox); not cached
- `JsonTology.toShacl()` — returns a fresh `OntologyBuilder` containing only the SHACL shapes (node shapes, property shapes) derived from all registered schemas; not cached
- Docs: restructured `docs/types.md` Utility Types section — each of the eight utility types (`DeprecatedKeysType`, `NonDeprecatedSchemaType`, `LooseInputType`, `EnumValuesType`, `ExhaustiveType`, `DefaultAlignedType`, `IntegerRangeType`, `MultipleOfRangeType`) now has its own H2 section with Declaration, Use this when, Don't use this when, Signature, Examples (bookstore domain), Bad examples, Comparison (Zod/TypeBox/AJV/Pydantic), Related, and See also; sidebar updated with per-type anchor links
- `jt:strict` keyword for per-field strict type enforcement — prevents coercion (string→number, truthy→boolean, etc.) on individual properties; `jt:strict: false` opts a field out when `jt:config.strict` is `true`
- `jt:frozen` keyword on object schemas — `coerce()` and `materialize()` return deeply-frozen values (all nested objects and arrays frozen); mutation throws in strict-mode ESM modules
- `jt:config` keyword for schema-level defaults — `strict` (default strict for all fields), `frozen` (shorthand for jt:frozen), and `extra` (`'ignore'` | `'allow'` | `'forbid'`) for unknown property handling
- `EXTRA_FORBIDDEN` error code for `jt:config.extra: 'forbid'` validation errors
- `JtConfigType` and `JtExtraType` exported from `json-tology/types`
- `Compose.extend()` merges `jt:config` keys — child wins per key; `pick()`/`omit()` carry `jt:config` unchanged
- `jtConfig`, `jtFrozen`, `jtStrict` fields on `SchemaGraphSemanticsInterface` for serializer and visualization use


- Docs rewrite: per-operator pages under `docs/validation/`, `docs/composition/`, `docs/transforms/`, `docs/value/`, `docs/errors/`, `docs/serialization/`, `docs/registry/`, `docs/advanced/`; bookstore eCommerce running domain (`docs/bookstore-domain.md`, `docs/_examples/bookstore.md`); per-operator section template (Declaration / Use this when / Don't use this when / Examples / Bad examples / Comparison / Related / See also); Zod/TypeBox/AJV/Pydantic comparison tabs on every operator; runnable examples under `examples/docs/` with smoke test in `test/smoke/docExamples.test.ts`; new sidebar in `docs/.vitepress/config.ts` with per-operator entries
- `dump(schemaId, value, options?)` on `JsonTology` — Pydantic-equivalent serializer that walks the canonical graph, applies `Transform` encoders, and supports `exclude`, `include`, `excludeUnset`, `excludeDefaults`, and `mode` ('wire' | 'json') options
- `dumpJson(schemaId, value, options?)` on `JsonTology` — convenience wrapper around `dump()` with `mode: 'json'` that returns a `JSON.stringify`-ready string
- `DumpOptionsInterface` in `src/interfaces/Dump.ts`, re-exported from `json-tology/interfaces`
- Cross-field invariant support (InvariantInterface, InvariantFnType) — register imperative post-validation checks via JsonTology.create({ invariants }), jt.addInvariant(), and jt.removeInvariant(). Invariants run after structural validation succeeds and append jt:invariant-keyed errors to errors(), throw CoercionError from coerce(), and return false from is().
- `jt:computed` keyword for Pydantic-parity computed fields: properties derived at coerce/materialize time from registered compute functions
- `ComputedStore` in `src/modules/registry/ComputedStore.ts` — mutable store for per-schema compute functions
- `computeds` option on `JsonTology.create()` and `JsonTologyOptionsInterface` for construction-time function registration
- `JsonTology.addComputed()` and `JsonTology.removeComputed()` for runtime compute function management
- `ComputedFnType` in `src/types/Computed.ts`
- `COMPUTED_INPUT_FORBIDDEN` and `COMPUTED_FN_MISSING` error codes
- Computed property `computed: boolean` flag on `SchemaGraphSemanticsInterface` for serializer and visualization use
- `jt:alias` keyword for Pydantic-equivalent field aliases — a schema property may declare a single alias string or a list of alias strings; `coerce()` maps alias input keys to the canonical key before validation and normalization
- `ValidationErrors.aggregate()` — compact rollup `{ count, paths, keywords }` for structured logging and metric labels (deduplicated, sorted, no unbounded `params` values)
- `ValidationErrors.report()` — RFC 7807 Problem Details payload for HTTP `422` error response bodies; accepts partial overrides for `instance`, `status`, `title`, and `type`
- `ProblemDetailsType` exported from `json-tology/types`

## [0.2.0] - 2026-05-03

### Added
- `jt:strict` keyword for per-field strict type enforcement — prevents coercion (string→number, truthy→boolean, etc.) on individual properties; `jt:strict: false` opts a field out when `jt:config.strict` is `true`
- `jt:frozen` keyword on object schemas — `coerce()` and `materialize()` return deeply-frozen values (all nested objects and arrays frozen); mutation throws in strict-mode ESM modules
- `jt:config` keyword for schema-level defaults — `strict` (default strict for all fields), `frozen` (shorthand for jt:frozen), and `extra` (`'ignore'` | `'allow'` | `'forbid'`) for unknown property handling
- `EXTRA_FORBIDDEN` error code for `jt:config.extra: 'forbid'` validation errors
- `JtConfigType` and `JtExtraType` exported from `json-tology/types`
- `Compose.extend()` merges `jt:config` keys — child wins per key; `pick()`/`omit()` carry `jt:config` unchanged
- `jtConfig`, `jtFrozen`, `jtStrict` fields on `SchemaGraphSemanticsInterface` for serializer and visualization use


- Vocabulary plugin system (`VocabularyPluginInterface`) for extensible custom RDF vocabularies
- `vocabularies` option on `JsonTology.create()`, `SchemaRegistry`, and serializer constructors
- CURIE expansion pipeline — all RDF projections now emit full IRIs instead of CURIE shortcuts
- `Curie` class and `CurieInterface` for compact URI expansion and compaction
- Serializer constructors (`GraphOntologySerializer`, `GraphShaclSerializer`) accept optional `CurieInterface` and `VocabularyPluginInterface[]`
- DCAT-AP 3.0.0 e2e test coverage — 20 entity schemas with property-by-property graph comparison against official W3C SHACL and OWL
- `toQuads()` / `fromQuads()` symmetric pair on `JsonTology` — project objects to RDF quads and lift quads back to typed objects
- `encode()` method on `JsonTology` — encode decoded value to wire representation
- `json-tology/viz` package export — `HtmlRenderer`, `TypeStringEmitter`, visualization types
- `rdfs:domain` and `rdfs:range` annotations accepted in both CURIE and full IRI forms in authored schemas
- Extended semantic predicates: `disjointWith`, `equivalentTo`, `inverseOf`, `transitive`, `symmetric`
- `commander`-based CLI replacing the hand-rolled parser
- `VocabProjection` base class consolidating shared conditional projection logic

### Changed

- JSON-LD output now uses full IRI keys (e.g. `http://www.w3.org/ns/shacl#property`) instead of CURIE shortcuts (`sh:property`)
- `dash:readOnly`/`dash:writeOnly` replace `jsonschema:readOnly`/`jsonschema:writeOnly` in OWL output
- Default prefixes expanded to include `sh`, `dct`, `dcat`, `foaf`, `skos`, `dash`, `prov`, `vann`, `schema`
- `abox()` renamed to `toQuads()` — symmetric with `fromQuads()`
- All module files renamed to PascalCase for consistency
- Test files realigned 1:1 with source modules
- Predicate dispatch consolidated to data-driven tables; `emitConstraintLiteral` extracted
- Canonical imports enforced; dead code removed; options-object call style normalized
- `SchemaIri` and `QuadFactory` converted to idiomatic static-method classes
- Logic relocated to domain modules that own the concepts

## [0.1.0] - 2026-03-10

### Added
- `jt:strict` keyword for per-field strict type enforcement — prevents coercion (string→number, truthy→boolean, etc.) on individual properties; `jt:strict: false` opts a field out when `jt:config.strict` is `true`
- `jt:frozen` keyword on object schemas — `coerce()` and `materialize()` return deeply-frozen values (all nested objects and arrays frozen); mutation throws in strict-mode ESM modules
- `jt:config` keyword for schema-level defaults — `strict` (default strict for all fields), `frozen` (shorthand for jt:frozen), and `extra` (`'ignore'` | `'allow'` | `'forbid'`) for unknown property handling
- `EXTRA_FORBIDDEN` error code for `jt:config.extra: 'forbid'` validation errors
- `JtConfigType` and `JtExtraType` exported from `json-tology/types`
- `Compose.extend()` merges `jt:config` keys — child wins per key; `pick()`/`omit()` carry `jt:config` unchanged
- `jtConfig`, `jtFrozen`, `jtStrict` fields on `SchemaGraphSemanticsInterface` for serializer and visualization use


- JIT schema compiler (`Compiler`) generating inlined per-schema check/errors/normalize/normalizeAndCheck functions
- `Value.parse` single-pass normalize+validate pipeline via `normalizeAndCheck`
- `Value.convert`, `Value.clean`, `Value.diff`, `Value.hash`, `Value.clone` utilities
- `Transform.pipe` for composing schema transforms
- `SchemaRegistry` with JIT fast-path and AJV fallback
- `SchemaOntologyDeriver` for semantic web output
- Benchmark suite vs TypeBox — 1.08–9.56x faster across all operations

### Changed

### Deprecated

### Removed

### Fixed

### Security

[Unreleased]: https://github.com/Studnicky/json-tology/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Studnicky/json-tology/compare/v0.1.0...v0.2.0
