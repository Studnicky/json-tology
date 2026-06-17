# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.24.2] - 2026-06-17

### Fixed

- **Documentation reflects the current compiled-validation architecture.**
  `architecture.md` describes `GraphEngine` as building and caching the schema
  graph (validation runs through the compiler), lists `RefResolution.ts` and
  `ShaclValidator.ts`, and no longer references the removed interpreter path or
  deleted `graph/visit` modules. The error reference documents
  `GraphErrorCode.REF_NOT_FOUND` and `SchemaErrorCode.PROPERTY_CHARACTERISTIC_CONFLICT`.
  The benchmarks page describes the single compiled path and states performance
  gaps directionally. The `date-time` format is documented as requiring an RFC
  3339 time offset.

## [0.24.1] - 2026-06-17

### Changed

- **Validation hot path is allocation- and dispatch-lean.** The compiled executor
  reuses per-node execution context (mutate-and-restore) and a shared `refStack`
  on ref-free subtrees instead of allocating a fresh context and `Set` per node;
  object/array option bags and single-type predicates are bound once at compile
  time rather than rebuilt per value; internal plan helpers signal pass/fail via a
  monomorphic numeric status instead of allocating result objects on the pass path.
  `$ref` targets resolve through a per-graph node cache (resolved once, not re-walked
  per value), and the ref-decoder registry adapter and materializer schema lookup
  are bound once on the instance. `minLength`/`maxLength` short-circuit from the
  UTF-16 length before scanning code points, `date-time` validates structurally
  (no `Date.parse` allocation, and strictly per RFC 3339), trusted built-in format
  validators skip the throw guard, `deepEqual` avoids iterator allocation, and
  per-node semantics build as a single stable-shape object. Throughput recovers
  26–47% across validation, instantiation, coercion, and conversion versus 0.24.0,
  reversing the regression tracked in #159. Behavior and JSON Schema 2020-12
  semantics are unchanged.

### Fixed

## [0.24.0] - 2026-06-16

### Added

### Changed

- **Validation runs a single compiled execution path.** Every keyword — `$ref`,
  `$dynamicRef`/`$dynamicAnchor`, `unevaluatedProperties`/`unevaluatedItems`,
  `rdfs:range`/`rdfs:domain`, and recursive/cyclic schemas and data — now compiles.
  The graph-interpreter validation executor is removed, and there is one compiled
  routine per feature (no separate boolean `check` compilation, no per-keyword
  check/validate duality, no base-vs-wrap composition duplication).
- **Materialization runs on the compiled path.** `createDefault()`,
  `materialize(..., { synthesizeDefaults })`, and the `passAdditionalProperties`
  option are served by compiled `synthesizeDefaults` (data-aware zero-value
  synthesis) and `ignoreAdditionalProperties` rather than the interpreter.

### Removed

- **BREAKING — `GraphEngine.execute()`, `.check()`, `.errors()`, and
  `GraphExecutionResultType` are removed.** Run validation through
  `registry.validate(id, data)` or `registry.validator(id).validate(data, options)`.
  `GraphEngine` is retained for schema-graph construction and `semantics()`.

### Fixed

- **Unresolvable `$ref` is reported, not silently skipped.** A `$ref` whose target
  is not registered surfaces a `REF_NOT_FOUND` error instead of passing validation.

## [0.23.1] - 2026-06-15

### Changed

- **Validation tests assert the rejecting keyword.** Cases that were hidden inside
  loop-based tests asserting only a valid/invalid boolean are now named per-case
  tests that also assert which keyword produced the rejection, so a schema failing
  for the wrong reason is caught rather than passing silently.
- **Coverage is measured at the source and gated.** The coverage workflow now
  measures `src/` coverage across unit and integration tests (excluding built
  artifacts and test files, which previously deflated the reported figure) and
  fails below lines 96% / branches 87% / functions 89%. Added table-driven
  `FormatRegistry` tests covering the format-validator rejection branches.

## [0.23.0] - 2026-06-15

Compile-time inference closes its remaining gaps with runtime validation, the
RDF projection layer drops its last duplicated logic, and the benchmark harness
measures real work instead of optimizer-elided no-ops.

### Added

- **`minContains` / `maxContains` constraint brands.** `InferType` now carries
  `MinContainsBrandType<N>` and `MaxContainsBrandType<N>` on arrays declaring
  those keywords — the last `contains`-family keyword that had no type-level
  trace.
- **`pattern` value narrowing on `type: 'string'`.** A recognised anchored
  pattern narrows the inferred value type via `PatternToKeyType`: `^(a|b|c)# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

 →
  `'a' | 'b' | 'c'`, `^prefix` → `` `prefix${string}` ``. Complex or unanchored
  patterns stay `string`, so the change is invisible to existing schemas.
- **`propertyNames: { pattern }` key narrowing.** Object key types narrow to the
  corresponding template-literal type, matching the existing `patternProperties`
  behaviour. Non-anchored patterns keep the open key type.

### Changed

- **Benchmark harness is dead-code-elimination safe.** Every bench closure's
  result is consumed through a volatile sink, so V8 can no longer elide cheap
  pure operations into fictitious sub-nanosecond measurements. All published
  benchmark results are regenerated against the corrected harness.
- **`type-check:tests` runs the full test glob.** The curated
  `tsconfig.types-test.json` (which silently excluded new type-test files) is
  removed; the script now shares `tsconfig.tests.json` with `type-check:tests:all`.

### Fixed

- **RDF projection duplication removed.** The byte-identical `contains`
  restriction filter is unified as `ProjectionIndex.filterContainsRestrictions`,
  and the shared cardinality numeric-parse guard as `ProjectionHelpers.finiteNumber`;
  OWL and SHACL projections delegate to both.

## [0.22.0] - 2026-06-14

Validation now executes on one path with two backends behind a single message
table; `$ref` resolution and the inline type surface are uniform and
graph-native; `format` and content assertions are enforced at runtime; and
annotated edges project as RDF 1.2 triple-terms or flat triples on demand.

### Added

- **Graph-native `$ref` resolution.** A `$ref` to a resource embedded under the
  schema's own `$defs` (a bundled compound document) resolves standalone, with no
  references map.
- **Global references registry.** A consumer-augmentable
  `JsonTologyReferencesInterface` is the default references map for `InferType`,
  `CanonicalShapeType`, `MaterializedSchemaType`, `ParseOutputType`, and
  `Transform.create`. After one `declare module 'json-tology/types'`
  augmentation, standalone types resolve cross-schema `$ref`s with no per-call
  map.
- **Registry-derived type helpers.** `RegistryReferencesType`,
  `RegisteredCanonicalType`, `RegisteredMaterializedType`, and
  `RegisteredOutputType` read a registered schema's resolved type straight off a
  `JsonTology` instance type — no hand-rolled `SchemaReferencesMapType`.
- Schema-valued `additionalProperties` on an object without declared
  `properties` now types the index signature (resolving `$ref` values) instead
  of collapsing to `Record<string, unknown>`.
- **Runtime `format` and content assertions.** `format`, `contentEncoding`, and
  `contentMediaType` are enforced at runtime (strict by default), so the
  matching compile-time brands reflect a real guarantee. Disable via the
  `format-assertion` vocabulary set to `false` for annotation-only behavior.
- **Single validation message table.** Both validation backends emit error
  messages from one `VALIDATION_MESSAGES` source, guarded by a cross-engine
  message-parity test and a single-source scan so the two backends cannot drift.
- **End-to-end reasoning example.** `examples/e2e-reasoning.ts` projects real
  bookstore objects to quads, encodes scalars into the typed literals an OWL/N3
  reasoner (EYE) consumes via Transform codecs, runs refund-eligibility and
  review-processing rules, and decodes the inferred verdicts back into TS values.
- **`annotationEmitMode` projection option.** `toQuads`/ABox projection accepts
  `annotationEmitMode: 'star-only' | 'flat-only' | 'both'` (default `'star-only'`)
  to control how annotated-edge annotations serialize: as RDF 1.2 triple-terms,
  as flat `<subject> <predicate> <value>` triples for RDF-star-unaware consumers,
  or both. The reasoning example shows the same annotation driving a flat rule
  and an RDF 1.2 triple-term (`<<( s p o )>>`) rule in EYE.

### Changed

- **BREAKING (type-level) — uniform `$ref` resolution.** An unresolvable `$ref`
  now resolves to a `RefNotFoundInterface` / `AnchorNotFoundInterface` brand
  rather than silently widening to `unknown`. This applies uniformly to bare
  absolute IRIs, fragment refs, and missing local `$defs` keys, named anchors,
  and JSON pointers. Consumers that relied on the silent `unknown` fallback will
  see the brand instead; thread references (global augmentation, a registry
  instance, or embedded `$defs`) to resolve, or handle the brand.
- **BREAKING (type-level) — format brand type names.** The named format-brand
  types use the `*BrandType` suffix (`EmailBrandType`, `UuidBrandType`,
  `DateTimeBrandType`, `Ipv4BrandType`, …), aligning with the convention that a
  `type` is the data substrate and `*Interface` is reserved for behavioral
  contracts.
- **BREAKING — error constructors.** Error classes follow the standard
  `new XError(message, options)` shape with the machine-readable `code` carried
  in the options bag, e.g.
  `new GraphError('Unresolved schema reference', { code: 'REF_UNRESOLVED', pointer })`
  in place of `new GraphError('REF_UNRESOLVED', 'Unresolved …', { pointer })`.
  `BaseError`, `SchemaError`, `GraphError`, `TransformError`, and
  `OwlImportError` change their public constructor signatures; `code` is required
  in the options object and narrowed to each class's code union.
- Error codes thrown as raw strings route through their `*ErrorCode` constants;
  `SCHEMA_DUPLICATE_ID`, `SCHEMA_DUPLICATE_SHAPE`, `INVALID_LANGUAGE_TAG`,
  `INVALID_PREDICATE_IRI`, `INVALID_IRI_VALUE`, `NON_FINITE_NUMBER`, and
  `MISSING_GRAPH_IRI` have named constants.
- **BREAKING — `format`/content enforced by default.** Schemas declaring the
  2020-12 dialect now assert `format`, `contentEncoding`, and `contentMediaType`
  rather than treating them as annotations. Data that was format- or
  content-invalid but previously passed now fails; opt out via the
  `format-assertion` vocabulary.
- **Unified validation execution.** Validation runs one path with two backends —
  the compiled validator is canonical, with the graph interpreter retained as its
  fallback for un-compilable keywords (`$dynamicRef`, `unevaluated*`,
  `rdfsRange`/`rdfsDomain`) and for cyclic data. Both backends share one `$ref`
  resolver and one message table.
- Unresolvable `$ref`s throw a typed `GraphError` (`REF_NOT_FOUND`, or
  `ANCHOR_NOT_FOUND` for a missing anchor) uniformly across the validation,
  projection, and materialization paths, rather than one path throwing and
  another silently returning no target.

### Removed

- **BREAKING — unused `./types` exports.** `ArrayResultType`,
  `ObjectResultType`, `ScalarResultType`, and `ValidateCallOptionsType` are
  removed (no consumers).
- Dead error codes `GRAPH_INVALID_RESTRICTION` and the `GraphError`
  `NOT_IMPLEMENTED`; unused schema constants `SetOpSchema`, `DelOpSchema`, and
  `DiffOpSchema`; and the unconsumed `RefsInterface`,
  `VisitCompositionInterface`, and `UnevaluatedInterface`.

### Fixed

- **Hash-namespace `$id` projection.** A class whose `$id` carries a fragment
  (e.g. `http://www.w3.org/2004/02/skos/core#Concept`) resolves its property
  schemas, so OWL and SHACL output carries that class's predicate bindings,
  annotations, and ranges.
- **Engine ref-stack isolation.** A recursion-limit error during validation
  leaves no stale entries in the engine's reused ref-stack, so later validations
  on the same engine evaluate `$ref`s rather than treating them as cycles.
- **Union effective properties.** Properties declared only inside `anyOf` /
  `oneOf` members are visible to materialization and ABox projection.
- **SHACL array ranges.** An array property whose items `$ref` a class (or carry
  a primitive type) emits its `sh:node` / `sh:class` / `sh:datatype` on the
  property shape itself, with no phantom `#items` shape.
- **Conditional decoders.** Transform decoders attached inside `if` / `then` /
  `else` and `not` branches are applied.
- **Compiled/interpreted parity.** The compiled validation path applies defaults
  and coercion for `anyOf` / `oneOf` members and emits constraint messages
  identical to the interpreted path.
- ABox projection raises `GraphError('REF_NOT_FOUND')` on an unresolvable
  `$ref`, invalid JSON pointers surface instead of being swallowed, and external
  RDF literals without a datatype default to `xsd:string`.
- Zero-value synthesis returns a value for `anyOf` / `oneOf` schemas.
- **Cyclic-data validation.** A recursive schema fed structurally-cyclic data no
  longer overflows the stack on the compiled path; `validate` and `materialize`
  terminate via the interpreter's recursion guard.
- **SHACL restriction projection.** A user `someValuesFrom` restriction no longer
  emits a spurious `sh:qualifiedValueShape`, and restriction-structured
  `subClassOf` relations now project as `sh:PropertyShape` with
  `sh:minCount`/`sh:maxCount` instead of being dropped.
- **CURIE expansion.** A CURIE reference containing colons (e.g.
  `urn:uuid:abc-123`) expands with the full reference preserved instead of being
  truncated at the first colon.

### Internal

- Deduplicated logic into canonical `noun.verb()` class methods
  (`SchemaIri.parseRef`, `Curie.expandIfNeeded`/`compact`,
  `QuadFactory.indexBySubject`, `Frozen.deepFreeze`); centralized predicate-IRI
  constants into `src/constants`; extracted all inline interfaces and type
  aliases into `src/interfaces` and `src/types`.
- Replaced hardcoded namespace IRIs with `OWL` / `RDF` / `RDFS` /
  `STANDARD_PREFIXES` constants; removed pass-through wrapper helpers;
  de-duplicated `findAnnotatedEdgeStructure` into `ProjectionHelpers`; dropped
  the `unicorn/no-thenable` lint rule (a false positive against the JSON Schema
  `then` keyword); synced `CLAUDE.md`, `docs/architecture.md`, and
  `docs/errors/classes.md` to the current code.
- **Dependencies.** Dropped the `vite` / `esbuild` resolution overrides so the
  docs toolchain resolves naturally (`tsx` now runs on the patched esbuild
  0.28.1); bumped `commander` to 15, `eslint-plugin-unicorn` to 66 (renamed
  `no-array-for-each` → `no-for-each`), and the remaining dev dependencies to
  current. `shell-quote` is patched to 1.8.4. The residual esbuild and `0x`/`d3`
  advisories are dev-server / profiling-only (not in the published package) and
  have no upstream-released fix.

## [0.21.0] - 2026-06-13

Transforms are redefined as **normalize transforms**. `decode` turns a raw wire
payload into the schema's canonical form and `encode` is the inverse; the runtime
order is now **decode → validate → strip**. The schema describes `decode`'s
OUTPUT, so validation runs on the decoded result — a value that is not
JSON-Schema-expressible (e.g. a `Date`) is rejected at the gate instead of being
silently admitted. This is a breaking change to the Transform contract.

### Changed

- **BREAKING — Transform direction.** `Transform.create` and
  `JsonTology.addTransform` now take `decode: (raw: TWire) => Canonical` and
  `encode: (Canonical) => TWire`. The free generic moved from the output (`TOut`,
  removed) to the wire input (`TWire`).
- **BREAKING — `instantiate` ordering.** `decode` runs first on the raw payload;
  validation and stripping then run on the decoded canonical value (previously
  validate-then-decode). `Transform.chain` is re-anchored so its last stage must
  produce the schema's canonical type.
- Transform mappers speak the brand-free structural canonical, so `decode`/
  `encode` need no per-leaf `brand()` calls — `validate` is the brand boundary.
- `materialize`'s partial input is typed as the brand-free canonical
  (`Partial<CanonicalShapeType<…>>`).
- Class hydration is expressed as the transform in reverse: the class is the wire
  type, `decode` lowers it to canonical JSON, and `encode` hydrates — so
  `jt.encode` is the hydration step.

### Added

- `UnbrandType<T>` — strips constraint brands from a type while preserving its
  structure (object/array shape, optionality).
- `CanonicalShapeType<TSchema, TReferences>` — the brand-free canonical form a
  normalize transform's `decode` produces and `encode` consumes.
- Ref-resolving canonical path: an optional `TReferences` generic on
  `Transform.create` so a `$ref`-bearing or composed transform schema resolves
  its canonical output type instead of degrading to `RefNotFound`.

### Removed

- **BREAKING — `LooseInputType`.** Superseded by `UnbrandType` (which preserves
  structure rather than flattening objects to `Record<string, unknown>`) and the
  `CanonicalShapeType` alias.

## [0.20.2] - 2026-06-07

Fixes annotated-edge nested-object IRI generation: `resolveEdgeTargetIri` was
passing a hardcoded depth of `0` to the minter for nested-object targets, causing
all such nodes to receive root-level Skolem/hash IRIs regardless of their actual
nesting depth. The correct `depth + 1` is now threaded through the call chain.

### Fixed

- **`resolveEdgeTargetIri` depth regression — annotated-edge nested objects.**
  `Projection.resolveEdgeTargetIri` now passes `depth + 1` to `minter.mint` for
  nested-object edge targets instead of the hardcoded `0`. `depth` is added to
  `ProjectAnnotatedEdgeArgs` and `ResolveEdgeTargetIriArgs` and threaded through
  the full call chain. Fixes IRI collapse when two annotated-edge targets produce
  different object shapes at different nesting levels.

## [0.20.1] - 2026-06-05

`allOf` cross-branch default pre-pass: a required field declared in one branch whose
default lives in a sibling branch no longer fails validation when `applyDefaults` is
active. The fix covers both the graph-engine path (`VisitComposition.allOf`) and the
compiled-validator path (`Composition.validateAllOf`), plus the `$ref` + sibling-property
variant in `GraphEngineVisit`.

### Fixed

- **`allOf` cross-branch defaults — graph engine path.** `VisitComposition.allOf` now
  runs a pre-pass that collects explicit property defaults from every branch before
  any branch's `required` check executes. A required field in branch N whose default
  lives in branch N+1 is pre-populated so the main-pass required check finds it already
  set. `synthesizeDefaults` is suppressed in the pre-pass so zero-values from earlier
  branches cannot shadow real defaults from later ones.
- **`allOf` cross-branch defaults — compiled validator path.** `Composition.validateAllOf`
  receives the same pre-pass: all `allOfValidators` run once with `applyDefaults: true`
  before the main loop, accumulating defaults into the working value without collecting
  errors into the final result set.
- **`$ref` + sibling property defaults.** `GraphEngineVisit` now pre-applies defaults
  from inline sibling properties on a schema node before `$ref` resolution, so a
  `$ref` schema's required check can see defaults supplied by co-located property definitions.

## [0.20.0] - 2026-06-04

A SHACL-native validation release: `JsonTology.validateWithShacl` closes the
`toShacl` / `validateWithShacl` loop so the same shapes that describe a schema
also enforce it. Annotated-edge annotation predicates are now grounded to a
shared vocabulary and emit valid RFC 3987 IRIs. Under the 0.x policy a breaking
change is a minor bump.

### Added

- **`JsonTology.validateWithShacl(shapes, data)` — native SHACL validation
  engine.** Accepts the `OntologyBuilder` produced by `toShacl()` or raw SHACL
  shape quads and returns a `ShaclValidationReportInterface` (`{ conforms,
  results }`). Each `ShaclValidationResultInterface` entry carries `focusNode`,
  `resultPath`, `resultSeverity`, `sourceConstraintComponent`, `value`, and
  `resultMessage`. Covers `sh:minCount`/`maxCount`, `sh:datatype`, `sh:class`,
  `sh:node`, `sh:pattern`, `sh:minLength`/`maxLength`,
  `sh:minInclusive`/`maxInclusive`/`minExclusive`/`maxExclusive`, `sh:hasValue`,
  `sh:in`, `sh:closed`, `sh:and`/`or`/`not` (including blank-node member shapes),
  `sh:qualifiedValueShape` with `qualifiedMinCount`/`maxCount`, and node-level
  constraints. Recursion is cycle-safe. New public interfaces
  `ShaclValidationReportInterface` and `ShaclValidationResultInterface`; new type
  `ShaclSeverityType`.
- **Predicate grounding for annotated-edge annotation sub-schemas.** Annotation
  sub-schemas inside `Compose.annotatedEdge` accept `x-jt-predicate` / `$id` to
  ground the annotation's predicate IRI to a shared vocabulary (e.g. schema.org).
- **Bookstore drift-check (`npm run build:bookstore-tbox:check`).** Verifies the
  generated bookstore graph data matches the current domain definition; wired into
  CI.
- **Runnable examples for previously-undocumented public API surface.** New
  examples cover: CURIE `toCurie`/`fromCurie`, `addTransform`,
  `BLANK_NODE_IRI_FOR`, `validateWithShacl`, `OntologyBuilder.shaclQuads` /
  `addFromJsonLd` / `addShaclFromJsonLd`, `owl-gen-node` `writeFromTbox` /
  `writeRegistryDirectory`, `GraphEngine`, `Skolemize.isWellKnownGenid`,
  `Compose.subClassOf` / `disjointWith` / `complementOf`, and duplicate
  detection. New `docs/advanced/shacl-validation.md` documentation page.

### Changed

- **Annotated-edge annotation predicate IRIs are grounded at projection/lift time
  (breaking, minor).** `PredicateResolver` resolves annotation predicates to
  canonical-flat or vocabulary-grounded IRIs, replacing the previous
  class-scoped pointer form. The predicate IRIs emitted for annotation quads in
  `toQuads` and `toShacl` output change accordingly.

### Fixed

- **Annotated-edge annotation predicates previously emitted an invalid
  multi-fragment IRI** (two `#`), rejected by RFC 3987-compliant triplestores
  (Oxigraph, Apache Jena Fuseki). Annotation predicates now emit a valid
  single-fragment IRI.
- **`PredicateResolver` rejects any resolved predicate IRI containing more than
  one `#` fragment** with `GraphError` code `INVALID_PREDICATE_IRI`.
- **`docs/bookstore-domain.md` reflects the current entity set** and the
  vocabulary-grounded annotated-edge `Review`.

## [0.19.0] - 2026-06-03

A type-architecture release: every typed public method yields a precise type or a
compile error — never `unknown`. Under the 0.x policy a breaking type-surface
change is a minor bump.

### Changed

- **`JsonTology<TMap, TRefs>` collapses to `JsonTology<TRefs>` (breaking, minor).**
  The single generic carries the registered schemas' raw shapes; output types are
  computed lazily per call as `ParseOutputType<TRefs[K], TRefs>` — identical
  precision to the former eager `TMap`, but O(1) to construct, so `declaration:
  true` (`.d.ts` emit) no longer trips TS2589 on deep registries. Consumers who
  wrote `JsonTology<SomeMap>` explicitly drop to the single type parameter.
- **An unresolved cross-schema `$ref` is a compile error, not a silent `unknown`.**
  A standalone `InferType<typeof Schema>` whose `$ref` targets a sibling that is
  not threaded now yields `RefNotFoundInterface<'urn:…'>` — a compile-error brand.
  Thread the reference map (`InferType<typeof Schema, Refs>`) or register the
  target to resolve it. A `$ref` to the schema's own `$id` resolves without a map.
- **Precise public method surface — no `unknown`/`boolean`-degraded overloads.**
  `is` / `materialize` / `validate` / `dump` / `dumpJson` / `fromQuads` /
  `subschemaAt` carry precise two-overload surfaces (registered `$id` or schema
  object), both threading `TRefs`; the loose `(schema: Record<string, unknown> &
  {$id}) → unknown | boolean` overloads are removed. `materialize` gains a
  string-`$id` form mirroring `instantiate`.
- **Wire-direction methods return the brand-free InputType.** `dump` and `encode`
  return `LooseInputType<…>` (the wire shape), never `unknown`. `Transform.create`'s
  `decode` input and `encode` output both speak the wire InputType, so transforms
  attached to composed / `$ref`-bearing schemas type cleanly.
- **Nominal-aware duplicate detection.** Two registered schemas that are explicit
  named subclasses (`Compose.subClassOf` / `allOf:[{$ref: Parent}]` carrying their
  own `$id`) no longer flag each other as `SCHEMA_DUPLICATE_SHAPE`; transform
  identity is folded into the structural hash so a transform-bearing primitive does
  not collide with a plain one of the same base shape.
- **CURIE `$id` canonicalization.** A schema registered under a CURIE `$id` is
  normalized to its absolute IRI across the registry, materialization, `sameAs`,
  and `Compose`, so CURIE and full-IRI references resolve to the same entity.
- **`Transform.getDecoder` takes the precise `JsonSchemaDocumentObjectType`,**
  accepting branded `Compose.*` schemas without an `as unknown as Record<…>` cast.

### Added

- **OWL → TypeScript codegen resolves cross-class types.** `generateFromTbox` /
  `generateRegistryFiles` thread a `SchemaReferencesMapType` over the generated
  schema set into every per-class `InferType`, so a generated `Book.author → Person`
  reference resolves to the precise sibling type instead of `unknown` — the
  ontology → TypeScript direction round-trips losslessly (single-file and
  registry-directory modes).
- **Declaration-emit regression test.** A deep, wide registry fixture emits its
  `.d.ts` without TS2589, run via `npm run test:decl` (wired into
  `type-check:all`), plus parity tests that string-`$id` `instantiate` /
  `materialize` still return the precise branded type.
- **Documentation.** Package-exports map, `instantiate` vs `materialize` decision
  table, and a duplicate-detection guide. The bookstore example exports
  `BookstoreRefs` for threading cross-schema inference.

## [0.18.0] - 2026-05-31

### Fixed

- **`allOf`-composed schemas are first-class across the engine.** Schemas built
  with `Compose.subClassOf` / `Compose.extend` (an `allOf` whose members carry
  the properties) are now handled wherever the engine previously read only a
  schema's own top-level `properties`:
  - ABox projection (`toQuads`) no longer drops `$ref`-targets whose schema is
    `allOf`-composed, so instances referencing a composed type round-trip
    through `fromQuads`.
  - `rdfs:domain` for a property declared inside an `allOf` member now resolves
    to the named owning class rather than the anonymous member node.
  - `jt.value.create` synthesizes a full instance across all `allOf` members
    (inherited + own fields), and `Compose.getDefaults` collects declared
    defaults from every member.

### Added

- **Bibliographic / retail split in the bookstore domain.**
  `urn:bookstore:BibliographicRecord` (isbn / title / authors / publishedOn) is
  the bibliographic base; `urn:bookstore:Book` now extends it via
  `Compose.subClassOf`, layering retail state (price, printStatus, inventory).
  `Book`'s effective type and validation are unchanged; the TBox emits
  `Book rdfs:subClassOf BibliographicRecord`.
- **Multi-format ETL example and guide.** A runnable usage example
  (`examples/docs/usage-examples/49-multi-format-codecs.ts`) and docs page
  (`docs/usage-examples/multi-format-etl.md`) that fan in three live book APIs
  (Google Books, OpenLibrary, Wikipedia) to the canonical
  `urn:bookstore:BibliographicRecord` via one `Transform.create` pivot codec per
  source. Demonstrates per-source wire schemas, a tag-keyed fan-in router,
  dual-boundary validation (wire-in via the wire schema, canonical-out via
  `jt.validate`), `owl:sameAs` cross-source provenance projected through
  `jt.toQuads`, enrichment-only sources, and a directional fan-out re-encode via
  `jt.encode`.

## [0.17.0] - 2026-05-30

### Added

- **Typed ABox graph traversal: `jt.aboxGraph(quads)`.** A fluent, dot-chained
  RDF cursor over projected ABox quads. Navigation reads the associations the
  TBox already emits (`rdfs:domain`, `rdfs:range`, `rdfs:subClassOf`,
  `owl:InverseFunctionalProperty`): `objects`/`subjects` traverse forward and
  inverse, `ofType`/`where`/`having` filter, `closure`/`subgraph` walk by hops,
  set operations and `orderBy`/`limit` shape the selection, and terminals
  (`one`/`first`/`all`/`iris`/`count`/`some`/`none`) lift each IRI to its typed
  instance. Foreign keys resolve through inverse-functional identity: a scalar
  key resolves to the entity it identifies whenever its range primitive backs an
  identity on a target class, including differently-named keys (`Review.bookIsbn`
  to `Book` via the shared `Isbn` range) and subclass-typed targets.
- **`json-tology/owl-gen-node`** entry point with `writeFromTbox` and
  `writeRegistryDirectory` for Node file output over the browser-safe codegen core.
- **Runnable, editable code examples across the documentation site.** Every
  runnable doc example renders as an in-browser playground: a CodeMirror editor
  with TypeScript syntax highlighting and an Execute button that transpiles and
  runs the edited code against the real library, showing the captured output.

### Changed

- **BREAKING: `json-tology/owl-gen` is now fully browser-safe and returns
  strings/data only.** `generateFromTbox` always returns the generated source
  string (the `output` write overload is removed), and `generateRegistryDirectory`
  returns the entity files as data (relative `path` plus `source`) and `indexSource`
  without writing to disk. File-writing moves to `json-tology/owl-gen-node`
  (`writeFromTbox`, `writeRegistryDirectory`), which preserves the prior
  disk-writing behaviour. Consumers writing to disk import from `owl-gen-node`.
- The library is now fully browser-safe: nothing a browser imports pulls in a
  `node:` builtin. The CLI binary is the only Node-specific surface, by design.
- Documentation prose is cleaned of em-dashes and filler vocabulary.

### Fixed

- Foreign-key resolution generalizes to differently-named keys sharing an
  identity range primitive and to subclass-typed targets that inherit a parent
  class identity.
- Many stale documentation examples are corrected to the current API: customer
  identity is `customerId`, the order schema uses `orderLines` and `orderTotal`,
  IRIs use the `urn:bookstore:` prefix, and `ValidationErrors` is accessed via
  `.items`. Every runnable example executes cleanly with no failing assertions.

## [0.16.0] - 2026-05-29

### Changed

- **BREAKING: a failing decode transform now throws `DecodeError` instead of
  `InstantiationError`.** The `.code` value `TRANSFORM_DECODE_FAILED` is
  unchanged, but it moves out of the `InstantiationError` code union into the
  new `TransformError` code union. Catch blocks for decode-transform failures
  must switch from `instanceof InstantiationError` to `instanceof DecodeError`.
- **BREAKING: a failing encode transform now throws `EncodeError` instead of
  leaking a raw `Error`.** `jt.encode()` and `dump` wrap any raw throw from a
  registered encode function in `EncodeError` (code `TRANSFORM_ENCODE_FAILED`,
  direction `'encode'`).
- **BREAKING: `value.cast()` / `value.convert()` are now strict.** When
  coerced data does not satisfy the schema these methods throw `CoercionError`
  instead of returning a best-effort value.
- **BREAKING: RDF property predicates are now flat, shared canonical IRIs by
  default.** A property's predicate is derived as `${baseIRI}/${propertyName}`
  (a single resource shared across every class that declares that property),
  replacing the previous class-scoped `${ClassIRI}#${propertyName}` form. This
  makes `rdfs:domain` a monotonic entailment over the union of binding classes
  and enables property hierarchies, characteristics, `owl:equivalentProperty`
  alignment, and cross-class reasoning. Predicate derivation lives in a single
  authority, `PredicateResolver`, consumed by ABox, TBox, SHACL, and `fromQuads`
  alike. Set `enableCanonicalPredicates: false` to derive class-scoped
  `${ClassIRI}#${propertyName}` predicates instead, for DTO bundles where
  coincidentally same-named properties must stay distinct.
- **BREAKING: bookstore example domain redesigned as a coordinated vocabulary.**
  Properties whose name collided across entities with differing ranges were
  renamed so each carries a distinct predicate: `Customer.id`→`customerId`,
  `Order.id`→`orderId`, `Order.total`→`orderTotal`, `Order.items`→`orderLines`,
  `Review.id`→`reviewId`, `BookListPage.total`→`resultCount`,
  `BookListPage.items`→`books`, `BookCatalogEntryVariant.price`→`variantPrice`.
  Genuinely shared concepts (`customerId`, `bookIsbn`, `isbn`) intentionally
  share one flat predicate.
- Runnable `examples/*.mjs` are now strict TypeScript (`examples/*.ts`).
  `examples/**` and `scripts/**` are covered by the type-check gate
  (`npm run type-check:all`).

### Added

- New exported error types `TransformError`, `DecodeError`, `EncodeError`, and
  the `TransformErrorCode` constant (`TRANSFORM_DECODE_FAILED`,
  `TRANSFORM_ENCODE_FAILED`). Decode and encode transform failures now raise
  typed, catchable errors with a stable `code`, a `direction` field
  (`'decode'`/`'encode'`), and an optional `path`/`schemaId` context.
  Consumers may throw `DecodeError` or `EncodeError` from custom handlers. The
  library propagates the thrown instance unchanged, preserving message and code.
- `CoercionError` (code `COERCION_FAILED`) is now an enumerated, documented
  error thrown by `value.cast()` / `value.convert()` (and the equivalent
  registry methods) when coerced data does not satisfy the schema. It carries a
  `ValidationErrors` collection on `.errors`.
- `enableCanonicalPredicates` (default `true`) and `predicateFor` options on
  `JsonTology.create`, mirroring the `enableStrictGraph` / `iriFor` precedents.
- `x-jt-predicate` (bind a property to an explicit predicate IRI), `x-jt-iriRef`
  (serialize an IRI-valued string property as a `NamedNode` rather than a
  literal), and `x-jt-language` (emit a language-tagged literal) schema keywords.
- TBox emits flat `owl:ObjectProperty`/`owl:DatatypeProperty` declarations; K
  classes binding one predicate yield a single property with a union
  `rdfs:domain`. `fromQuads` reverses flat predicates with subject-type-aware
  resolution, disambiguating shared predicates by the subject's `rdf:type`.
- CURIE-valued predicate bindings (`x-jt-predicate`/`predicateFor` returning a
  compact `prefix:local`) are expanded to full IRIs on `toQuads` emit and
  matched on `fromQuads` lift via the active prefix map, like subject/object
  IRIs.

### Fixed

- `DuplicateIdsType` no longer flags schema tuples of distinct `$id`s as
  duplicates; `IdsUnionType<readonly []>` now resolves to `never` instead of
  `string` via a distributive `IdOfType` naked-parameter conditional.
- ABox projection (`toQuads`) now emits `allOf`-inherited (subclass) and
  `if/then/else` conditional-branch properties, not just the entry node's own
  properties, e.g. a `PrintBook` instance now projects its inherited `Book`
  fields. `fromQuads` was fixed symmetrically (lifting own + inherited +
  branch properties), and `isStructurallyCompatible` no longer treats an
  `allOf`-based subclass with an empty root as compatible with every candidate.
- `SchemaCompiler` no longer strips conditional-branch-only properties (e.g. a
  property that exists only under an `if/then` branch) before the branch
  validator runs.
- ABox literal datatypes are now read from the property's declared graph
  type+format (via `XsdTypes`) instead of being inferred from the JavaScript
  runtime value, so `toQuads` and `toTbox`/`toShacl` agree on `xsd:int`,
  `xsd:float`, `xsd:decimal`, etc. (runtime inference remains only the fallback
  for untyped values).
- The XSD↔JSON-Schema reverse type mapping (previously three divergent tables in
  `importDispatch/Properties`, `importDispatch/Datatypes`, and `OwlImporter`) is
  consolidated into one `src/constants/XSD_REVERSE_MAPS.ts`, and the SHACL/XSD
  facet correspondence into one bidirectional `src/constants/XSD_FACETS.ts`, a
  single source for each, eliminating drift.
- `jt:annotatedEdge` is now a `SchemaGraphSemanticsInterface` field populated
  during semantics extraction; relation building reads it via `graph.semantics()`
  rather than re-reading the raw schema, closing the last keyword that bypassed
  the canonical-graph semantics API.
- OWL restriction / axiom `owl:onProperty` and SHACL `sh:path` now resolve the
  property predicate through `PredicateResolver`, so they reference the SAME IRI
  the property declaration and ABox use (flat by default, class-scoped under
  `enableCanonicalPredicates: false`) instead of always emitting the class-scoped
  form. Cardinality/value restrictions are no longer orphaned from instances for
  reasoners.
- `fromQuads` round-trips losslessly for temporal and decimal data:
  `xsd:dateTime`/`xsd:date`/`xsd:time` lift back to their original ISO string
  (not a `Date`), `xsd:decimal`/`double`/`float` to `number`, and quads are
  de-duplicated per subject (RDF set semantics) so a shared nested node
  (e.g. one `Money` referenced twice) no longer lifts as spurious arrays.
- `$ref`s targeting an embedded `$defs` `$id` now resolve in both `toQuads`
  projection and `fromQuads` lift instead of throwing `REF_UNRESOLVED`.
- Input hardening: empty / control-character / unresolved-CURIE predicate IRIs
  (`x-jt-predicate`, `$id`, `predicateFor`), non-finite numbers, invalid
  `x-jt-iriRef` IRI values, and non-BCP-47 `x-jt-language` tags are now rejected
  with structured `GraphError`/`MaterializationError`s; `JsonLdFormatter` and the
  annotated-edge lift no longer let a `__proto__`/`constructor` predicate or
  annotation key traverse the prototype chain.
- `JsonTology.validateWithShacl` throws a structured `GraphError('NOT_IMPLEMENTED')`
  instead of a bare `Error`.

## [0.15.3] - 2026-05-25

### Fixed

- Prototype-polluting assignment in `Operations.patch()`: path segments
  `__proto__`, `constructor`, and `prototype` are now rejected, preventing
  property injection via crafted diff paths.
- Shell command injection in `test/e2e/cli.test.ts`: replaced `execSync`
  string interpolation with `execFileSync` using an argv array.
- Incomplete URL substring sanitization across test and example files:
  `String.includes()` replaced with `assert.match()` regex assertions,
  `Array.includes()` replaced with `.some()` strict-equality checks.
- Missing least-privilege `permissions` blocks on all CI workflow jobs:
  `contents: read` added to `ci.yml`, `security.yml`, `coverage.yml`,
  `changelog-check.yml`, and `publish.yml` (validate job).

## [0.15.2] - 2026-05-24

### Added

- `test/e2e/eyeReasoner.test.ts` promotes the former
  `examples/e2e-reasoning.ts` walkthrough into an asserted e2e test.
  Verifies that json-tology's ABox output drives the EYE OWL/N3 reasoner
  end-to-end against the canonical bookstore domain. Four `it` blocks
  cover `:purchased`, `:reviewed`, `:isVerifiedReviewerOf`, and absence
  of literal-subject leakage. Suite is skipped when the optional
  `eyereasoner` peer dependency is absent.

### Changed

- `test/e2e/ontologyRoundTrip.test.ts` rewritten to use the canonical
  bookstore domain instead of the inline HR domain. Every e2e test now
  lives on the same bookstore narrative (Bastian Balthazar Bux's order
  of the 1979 Thienemann printing of `Die unendliche Geschichte`). All
  31 tests preserved and translated; file shrunk from 1,038 → 715 lines.
- `eyereasoner` moved from `devDependencies` to optional `peerDependencies`
  (`peerDependenciesMeta.optional: true`). Consumers who don't use the
  reasoner pay no install cost; the e2e test dynamic-imports the package
  and skips its suite when absent.

### Removed

- `examples/e2e-reasoning.ts`, promoted to an asserted e2e test
  (see Added).

## [0.15.1] - 2026-05-24

### Changed

- `examples/e2e-reasoning.ts` rewritten end-to-end on the bookstore
  domain. Validates the canonical Bastian/`Die unendliche Geschichte`
  fixtures, emits TBox + SHACL, projects four fixtures to rdf/js quads
  via `toQuads`, serialises them with the `n3` Writer, appends three N3
  inference rules that chain through `Customer#id` / `Book#isbn` so
  inferred predicates land on instance IRIs, and hands data + rules to
  EYE (WASM). The demo now derives that Bastian is a verified reviewer
  of the rare 1979 Thienemann printing, derived purely from
  json-tology's ABox output plus the three rules, with no hand-rolled N3.
- Dependency bumps via dependabot:
  - `qs` 6.15.0 → 6.15.2 (patch, runtime).
  - `actions/upload-pages-artifact` 4 → 5 (CI infrastructure).
  - `eslint-ecosystem` group (3 packages, dev tooling).
  - `minor-and-patch` group (5 packages: `@types/node`, `cytoscape`,
    `eyereasoner`, `tsx`, `vitepress-sidebar`).

No source-code changes; tests, build, lint all green. Runtime and API
surface identical to 0.15.0.

## [0.15.0] - 2026-05-24

### Added

- `JsonTology.toCurie(iri)` and `JsonTology.fromCurie(value)`: restore
  the CURIE helpers using the registry's merged prefix map.

### Changed

- Docs: `errors/classes.md` updated for v0.15.0 constructor signatures
  (BaseError, SchemaError, GraphError now take a single trailing options
  bag); LoadError section removed.
- Docs: `argument-conventions.md` canonicalizes the universal convention
  (required positional, optional/overrides in single config object).
  `advanced/utilities.md` adds coverage for `IdentifierIssuer` and
  `STANDARD_PREFIXES`. `advanced/ontology.md` adds a section for the
  experimental `JsonTology.validateWithShacl(shapes, data)` stub.
  `static-helpers.md` references `STANDARD_PREFIXES` directly.

### Removed

- `src/constants/PREFIXES.ts` vestigial exports (`DEFAULT_PREFIXES`,
  `XSD_PREFIX`, `RDF_TYPE_IRI`, `XSD_IRI_PREFIX`, `RDFS_IRI_PREFIX`,
  `RDFS_DOMAIN_IRI`, `RDFS_RANGE_IRI`, `RDFS_SUB_CLASS_OF_IRI`). Use
  `src/constants/IRI.ts` (`RDF.type`, `RDFS.domain`, `RDFS.range`,
  `RDFS.subClassOf`, `XSD.*`) and `src/constants/STANDARD_PREFIXES.ts`
  (canonical prefix-to-namespace map) as the single canonical source.

### Docs

- TSDoc coverage added for v0.15.0 new exports (validateWithShacl,
  IdentifierIssuer, options/error types).

### Changed

- **Error constructors aligned with the DX argument convention:**
  `BaseError`, `SchemaError`, and `GraphError` now take their optional fields
  through a single trailing options bag instead of mixed positional
  parameters. `BaseError(code, message, options?: BaseErrorOptionsType)`
  folds the prior `retryable` positional into `options.retryable` (default
  `false`). `SchemaError(code, message, options?: SchemaErrorOptionsType)`
  folds `schemaId` into the bag. `GraphError(code, message, options?:
  GraphErrorOptionsType)` folds `pointer` into the bag. `MaterializationError`,
  `InstantiationError`, `CoercionError`, and `OwlImportError` route their
  `cause` chains through the new `BaseError` shape. The `instanceof`
  semantics, `code` values, and `toJson()` / `flatten()` output are
  unchanged.
- **DX argument convention:** every callable surface aligns on a single
  contract: required arguments stay positional in stable canonical order;
  optional, override, or configuration values collapse into a single trailing
  options object typed by an `Interface` or `Type` alias. `QuadFactory.iri`,
  `QuadFactory.literal`, `QuadFactory.emitLiterals`,
  `QuadFactory.emitConstraintLiteral`, and `QuadFactory.quad` accept their
  optional `curie` (and `graph`, for `quad`) overrides via a single options
  bag: `QuadFactoryIriOptsInterface`, `QuadFactoryLiteralOptsInterface`,
  `QuadFactoryEmitOptsInterface`, and `QuadFactoryQuadOptsInterface`.
  `IdentifierIssuer`'s constructor takes a single
  `IdentifierIssuerOptsInterface` bag (`prefix`, `existingMap`, `counter`) in
  place of three optional positionals; `clone()` and the `JsonLdToQuads`
  internal counter construct via the bag. All OWL projection call sites in
  `OwlProjection`, `ShaclProjection`, and `Projection` pass `curie` through
  the options bag, restoring a single uniform signature shape across the
  quad-factory surface.

### Removed

- **`LoadError` and `LoadErrorCode`:** dead public surface with no production
  throw sites. The class, its error-code constant object, and the
  `LoadErrorCodeType` union are gone from the public API along with the
  `examples/docs/errors/18-load-error.ts` example. The unrelated
  `SchemaLoadErrorSchema` JSON Schema in `src/constants/SCHEMAS.ts` (used by
  loader-result reporting) is unaffected.

### Added

- **Graph-native list traversal, sibling indexing, and literal-tag
  preservation:** `SchemaGraphInterface` exposes two new methods used by the
  OWL import dispatchers to consume the canonical graph without falling back
  to raw quad iteration:
  - `collectList(head)` walks an `rdf:first` / `rdf:rest` / `rdf:nil` chain
    rooted at a NamedNode IRI or blank-node id and returns each item as a
    `ListItemType` (`{ termType, target, datatype?, language? }`).
  - `relationsForSubject(subjectIri)` returns every outgoing relation for a
    given subject, including blank-node subjects (restriction bnodes,
    negative-property-assertion bnodes, list-head bnodes). The quad-backed
    implementation builds a subject index lazily on first call.
  `SchemaGraphRelationInterface` adds three optional fields populated by the
  quad-backed graph: `termType: 'NamedNode' | 'BlankNode' | 'Literal'`,
  `datatype` (XSD datatype IRI for Literal targets), and `language` (BCP47
  language tag for langString literals). The forward-projection graph leaves
  these fields undefined (its relation targets are always graph nodes or
  IRIs); `SchemaGraph.collectList` returns `[]` because the projection graph
  does not retain `rdf:List` chains.

### Changed

- **All OWL import dispatchers are now graph-native:** zero raw-quad
  iteration remains in `src/modules/ontology/importDispatch/*`. The
  `Annotations`, `ClassAxioms`, `ClassExpressions`, `Datatypes`, and
  `Individuals` dispatchers were the last holdouts; each now reads its
  axioms exclusively from `ctx.graph.allRelations()` and uses the new
  `collectList` / `relationsForSubject` helpers plus the
  `language` / `datatype` / `termType` fields on each relation to recover
  the structural shapes (RDF list members, blank-node sibling predicates,
  language-tagged literals, typed-literal facet values) that previously
  required walking the source quad array. The `quads` parameter on each
  dispatcher is retained as `_quads` for back-compat with
  `DispatcherFnType`; the dispatcher table in `OwlImporter` still passes
  it but no dispatcher reads from it.

- **Graph-native OWL import dispatchers:** `Characteristics`,
  `ClassAxioms`, `Properties`, and `PropertyRestrictions` dispatchers now drive
  axiom detection from `ctx.graph.allRelations()` rather than scanning raw
  quads. `QuadBackedSchemaGraph.NODE_TYPES` extends to the seven OWL 2 property
  characteristic classes (`owl:FunctionalProperty`, `owl:TransitiveProperty`,
  etc.) so properties declared solely via a characteristic axiom still surface
  as graph nodes. Compacted CURIE targets emitted by the graph layer are
  expanded back to full IRIs in each dispatcher before structural comparison.

- **Correct OWL semantics for `anyOf` and `oneOf`:** `anyOf` branches now emit `owl:equivalentClass` + `owl:unionOf` (union of class expressions); `oneOf` branches emit `owl:disjointUnionOf` (disjoint union). Import round-trip reconstructs `anyOf` from `owl:unionOf` quads and `oneOf` from `owl:disjointUnionOf` quads symmetrically. `OWL.disjointUnionOf` added to `IRI_PREDICATES` for `Projection.graph()` emission. `$ref` targets in `anyOf`/`oneOf` branches are now resolved to their canonical IRI rather than the intermediate pointer node.

- **Full-IRI wire format:** `src/constants/IRI.ts` now derives every constant
  value from `STANDARD_PREFIXES` as a full IRI (e.g. `RDF.type` =
  `'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'`). `XsdTypes.resolve` and
  `XsdTypes.resolveSingle` return full XSD IRIs. `XSD_MAPS.ts` maps all JSON
  Schema type/format pairs to full IRIs. `DEFAULT_PREFIXES` is now derived from
  `STANDARD_PREFIXES` (single source of truth). `OWL.disjointUnionOf` is added.
  All projection call sites (`OwlProjection`, `ShaclProjection`, `Projection`)
  emit quads with full-IRI predicates and object terms. Compact CURIEs no
  longer appear in the quad stream.

- **Per-serialization bnode isolation:** `BaseGraphSerializer.serializeQuads`
  creates a single `IdentifierIssuer` shared across all graph projections in a
  batch, preventing blank-node ID collisions when multiple schemas are serialized
  together. Individual `OwlProjection.graph` / `ShaclProjection.graph` calls
  still create their own issuer (deterministic per-call naming). The shared
  issuer is threaded via an optional `issuer?` parameter on `projectGraph`.

- **`QuadFactory.quad` H-4 signature:** accepts `{ curie?, graph? }` options
  bag. The `graph` option stamps a named-graph term at construction time (Wave 2
  H-4 will remove the second-pass mutation in `Projection.ts`).

### Removed

- **`Lift.fromExternalQuad` / `fromExternalRdfJsQuad` deprecated path:** both the internal
  implementation and the exported wrapper are deleted. The sole caller in
  `OwlImporter.fromJsonLdRdfOutput` now constructs `QuadInterface` values directly via `Terms`
  factory methods, preserving full IRI datatypes and predicates throughout the pipeline.
  `normalizeDatatype` and `coerceLiteralValue` (compact-CURIE conversion helpers) are removed
  alongside them. The `typeOf()` dual-form check (`RDF.type || RDF_TYPE_IRI`) in `Lift.ts` is
  collapsed to a single `RDF.type` comparison since both values are identical full IRIs after
  the Phase 2 IRI normalisation.

### Fixed

- **Concurrent blank-node safety:** `QuadFactory`, `Lists`, and the projection
  pipeline (`Projection`, `OwlProjection`, `ShaclProjection`) now use a
  per-call `IdentifierIssuer` for all blank-node naming. The module-level
  `bnodeCounter` in `QuadFactory` and `listBnodeCounter` in `Lists` are removed
  entirely; `resetBnodeCounter()` and `resetListBnodeCounter()` are gone from
  the public surface. Each call to a projection entry point creates its own
  issuer that owns the counter for that call's lifetime, preventing
  counter-corruption between overlapping serializations in concurrent server
  environments. A new `IdentifierIssuer` class (ported from the
  semantics/rdf-canonicalize package) and its `IdentifierIssuerInterface` are
  introduced in `src/modules/rdf/IdentifierIssuer.ts` and
  `src/interfaces/IdentifierIssuer.ts` respectively.

### Performance

- **H-9** `GraphEngine.execute()`: hoists `dynamicScope` to a per-engine reusable array
  (never mutated in-place) and reuses a per-engine `refStack` Set (symmetric add/delete
  per frame guarantees it is empty on re-entry). `evaluatedItems` / `evaluatedProperties`
  fall back to module-level frozen empty sets instead of allocating `new Set()` at the
  result boundary. Eliminates 4 short-lived allocations per validation call.
- **H-10** `Curie.compact()`: adds a dedicated `compactCache: Map<string, string>`.
  Prefixes are immutable post-construction so the cache is always valid. Eliminates an
  O(prefixes) linear scan on every repeated `compact()` call.
- **H-11** `Projection.ts` ABox path: hoists a single `quadOpts: QuadOptsInterface`
  object in `projectAbox()` and threads it through `projectInstance()` and
  `projectSingleValue()`. All `QuadFactory.quad(..., { curie, graph })` calls in the
  ABox hot path reuse one allocation instead of creating a fresh object per quad.
  `ProjectInstanceArgs` and `ProjectPropertyArgs` gain a `quadOpts` field.
- **H-12** `GraphEngine.validateObject()`: caches the `patternPropertyEntries` mapped
  array via `WeakMap<SchemaGraphNodeInterface, ...>`. Schema nodes are stable
  post-registration; the cache is always valid. Eliminates a per-validation-call array
  allocation for every object validated against a schema with `patternProperties`.
- **M-F-2** `SchemaRegistry.instantiate()`: passes `this.instantiateOptions` directly
  when `callOptions?.enableDefaults` is not set. Eliminates a spread allocation on the
  common fast path.
- **M-F-3** `SchemaRegistry.list()` / `listGraphs()`: uses `Array.from(values, mapper)`
  to fuse the spread + map step into a single pass.
- **M-F-4** `SchemaEntryStore.findDuplicates()`: caches `topLevelHashes` between calls;
  invalidated on every `add()`, `delete()`, or `clear()`. The previously O(N) hash
  rebuild per `findDuplicates()` call becomes O(1) on a warm cache.
- **M-F-5** `Materializer.collectEffectiveProperties()`: memoizes via a two-level
  `WeakMap<graph, WeakMap<node, result>>`. Graph and node objects are stable
  post-registration. Eliminates repeated `Map` + `Set` allocations on repeated
  `fillImplicitProperties` calls for the same schema node.
- **M-F-6** `SchemaRegistry.addCharacteristic()`: hoists `CHARACTERISTIC_TO_KEY` to
  module-level `Object.freeze()` constant. Eliminates a per-call object allocation.
- **Phase 3 coordination:** completes Phase 3 issuer threading in `OwlProjection.ts`
  and `ShaclProjection.ts`: all `QuadFactory.nextBnode()` and `QuadFactory.rdfList()`
  call sites in `OwlVocabProjection` and `emitClassQuads` / `emitDatatypeQuads` /
  `emitPropertyQuads` / `emitContainsQuads` / `emitPrefixItemQuads` /
  `emitArrayItemQuads` receive the per-call `IdentifierIssuer`. `SpecialHandlerFn` type
  updated to carry the issuer parameter.

- **H-1: `jt:restrictions` enters the canonical graph:** `SchemaGraphSemanticsInterface`
  gains a `restrictions: ReadonlyArray<RawRestrictionDescriptorType>` field. `SchemaGraphSupport.semantics()`
  populates it from the `jt:restrictions` array on the raw schema. `SchemaGraphRelations.extractRelations`
  emits each restriction entry as an `rdfs:subClassOf` relation with `structure.kind === 'restriction'`,
  making user-declared OWL property restrictions visible to `graph.allRelations()`. `OwlProjection.emitClassQuads`
  handles these restriction-structured subClassOf relations by emitting proper OWL restriction blank nodes.
  `emitUserRestrictions` (the raw-schema bypass) is removed. `QuadBackedSchemaGraph.resolveRestrictionBnode`
  now keeps constraint predicates as full IRIs so `PropertyRestrictions` dispatcher comparisons against
  `OWL.*` constants succeed. Round-trip coverage added in `test/integration/owlRoundTrip.test.ts`.
- **H-2: primitive `format` annotation enters the canonical graph:** `SchemaGraphRelations.extractRelations`
  now emits a `JT.format` relation for every node where `sem.format` is defined. `OwlProjection.emitDatatypeQuads`
  reads format from the projection index via `entry.byPredicate.get(JT.format)` instead of
  `entry.all[0].source.schema.format`. The raw-schema bypass is removed. Round-trip coverage added in
  `test/integration/owlRoundTrip.test.ts`.

### Added

- **`JsonTology.validateWithShacl` skeleton:** `validateWithShacl(shapes, data)` is added to
  the facade with an `@experimental` TSDoc marker. Always throws `NOT_IMPLEMENTED` with a clear
  message directing callers to `toShacl().shaclQuads()` + an external SHACL processor.
  `toShacl()` gains an asymmetry note in its TSDoc pointing at the planned inverse.

- **`IdentifierIssuerInterface` and `ValidateCallOptionsInterface` exported:** both are now
  included in the `json-tology/interfaces` barrel. `IdentifierIssuerInterface` describes the
  per-call blank-node issuer contract; `ValidateCallOptionsInterface` describes the per-call
  options bag for `SchemaRegistryInterface.validate`.

- **Subpath smoke test:** `test/smoke/subpathExports.test.ts` imports from every declared
  `exports` subpath (`"."`, `"./value"`, `"./schema"`, `"./ontology"`, `"./types"`,
  `"./interfaces"`, `"./owl-gen"`) and asserts top-level exports are present. Catches broken
  `exports` map entries without a full pack/install cycle.

- **`NormalizedToQuadsOptionsType` exported from `json-tology/types`:** was reachable
  internally but absent from the public types barrel.

### Changed

- **`@internal` markers on unexported interface files:** `BuildOptions`, `RefResolutionLoader`,
  `SchemaRefWalker`, `SimplePredicateEntry`, and `VizOptions` in `src/interfaces/` now carry a
  `@internal` JSDoc tag at the top of the file so contributors know they are intentionally
  absent from the public barrel.

- **`JsonTology.materializer` trade-off documented:** the `public readonly materializer`
  field gains a TSDoc warning: callers that invoke `projectAbox` directly bypass the
  `owl:sameAs` quad emission that `toQuads()` performs.

- **`@throws` TSDoc on facade methods:** `is`, `subschemaAt`, and the existing methods
  that were using `{@link SchemaError}` are updated to the canonical `{SchemaError} code X`
  format, matching the style used across the rest of the facade.

- **`SchemaGraph.keywordValue` usage note:** TSDoc now documents that the method returns
  the literal authored value, not a semantically-resolved value, and when it is correct
  to call it.

- **Blank-node identity trade-off in `SameAsStore`:** class TSDoc documents that
  blank-node subjects are transient and meaningless to reasoners across serialization
  boundaries; `sameAs` should only be called with stable named-node IRIs.

- `bench/toQuads.bench.ts`: standalone ABox projection benchmark covering three schema
  shapes (flat 5-property, 1-level nested, `patternProperties`). Baseline (before Phase 6
  perf fixes) on Node 24 (Apple M-series): flat 171k ops/s (5.82 us), nested 135k ops/s
  (7.39 us), pattern 227k ops/s (4.39 us). After Phase 6: flat 174k ops/s (5.76 us),
  nested 139k ops/s (7.20 us), pattern 229k ops/s (4.36 us). Also adds cross-schema
  ref resolution in `Projection.abox()` via optional `lookupGraph` callback; fixes
  known C-4 failure (nested address property was dropped on cross-schema round-trip).

- Error code `.code` assertions: every live public error code has at least one
  test pinning `err.code === 'EXACT_VALUE'`. New tests added in `test/integration/coverageGaps.test.ts`:
  `POINTER_NOT_SCHEMA` (via `SchemaGraph.resolvePointer` on a scalar leaf), and
  `ANCHOR_NOT_FOUND` (via `SchemaGraph.resolveFragment` for an undeclared anchor name).
  Existing coverage confirmed for `DIALECT_UNSUPPORTED`, `VOCABULARY_UNSUPPORTED`,
  `COMPUTED_INPUT_FORBIDDEN`, `SCHEMA_VALIDATOR_MISSING`, and `OWL_IMPORT_NOT_IMPLEMENTED`.
- C-4 cross-schema `$ref` round-trip test in `test/e2e/ontologyRoundTrip.test.ts`:
  exercises `toQuads` → `fromQuads` for `Employee.address` (separately registered `Address`).
  Root cause of failure documented: `Projection.abox` drops cross-schema `$ref` properties
  because `resolveNode()` does not follow non-local refs into the registry
  (`src/modules/rdf/Projection.ts`, Phase 6 scope).
- `BOOLEAN_SCHEMA_FRAGMENT` and the four unreachable `OWL_IMPORT_*` codes confirmed
  absent from `src/constants/ERROR_CODES.ts` and `src/types/ErrorCodes.ts` (cleaned prior).

### Added

- `OntologyBuilderInterface` in `src/interfaces/Ontology.ts`: `OntologyBuilder`
  now declares `implements OntologyBuilderInterface`. Vocabulary-plugin authors
  and test doubles can type against the interface.
- `ComputedStoreInterface` and `SameAsStoreInterface` in `src/interfaces/`:
  `SchemaRegistryInterface` fields `computedStore` and `sameAsStore` are now typed
  against interfaces rather than concrete classes. `ComputedStore` and `SameAsStore`
  carry `implements` clauses.
- `TransformStageInterface`, `AnyTransformStageInterface`, `IriMinterInterface`,
  `ProjectInstanceArgs`, and `ProjectPropertyArgs` exported from `json-tology/interfaces`.
- `ToQuadsOptionsType` exported from `json-tology/types`.
- `DispatcherFnType` and `SubjectIndexType` in `src/interfaces/OwlImport.ts`:
  shared across all OWL import dispatcher modules; local duplicates removed.
- `@experimental` tags on `VocabularyPluginInterface`, `OwlGen` interfaces, and
  `OwlCodegen` interfaces to signal pre-1.0 surface stability.
- `@throws` TSDoc lines on `JsonTology.validate`, `instantiate`, `toQuads`,
  `fromQuads`, and `fromTbox` citing the error class and code value.

### Changed

- `ToQuadsOptionsType` moved from inline declaration in `src/JsonTology.ts` to
  `src/types/ToQuadsOptions.ts`. Canonical placement per module rules.
- `DuplicateReportEntryType` import in `src/JsonTology.ts` now references the
  defining file `src/interfaces/SchemaEntryStore.ts` directly instead of the
  module barrel `src/modules/registry/SchemaRegistry.ts`.
- `RestrictionDescriptorInterface` renamed to `RestrictionDescriptorType` in
  `src/types/Restriction.ts`: pure data shape in the `src/types/` directory
  carries a `Type` suffix per naming convention.
- `SchemaCompiler.compile()` and `SchemaCompilerInterface.compile()`: `graph`
  parameter changed from optional to required. The registry always passes a graph;
  the internal fallback `new SchemaGraph(schema)` is removed.
- `Lift.fromExternalQuad` deprecation notice updated to reference the canonical
  replacement: `Lists.narrowExternalQuads(quads)` + `Lift.instances()`.
- `SubjectIndex` / `SubjectQuadIndex` local type aliases in
  `importDispatch/Datatypes.ts` and `importDispatch/ClassExpressions.ts` replaced
  with the shared `SubjectIndexType` import from `src/interfaces/OwlImport.ts`.
- `DispatcherFn` local type in `OwlImporter.ts` replaced with `DispatcherFnType`
  from `src/interfaces/OwlImport.ts`.

### Removed

- Dead error code `BOOLEAN_SCHEMA_FRAGMENT` removed from `GraphErrorCode` constant
  and `GraphErrorCodeType` union. The code was never thrown in production.
- Unreachable `OwlImportErrorCode` values `INVALID_DATATYPE`, `MALFORMED_CLASS`,
  `UNKNOWN_AXIOM`, and `UNRESOLVED_REF` removed. Only `OWL_IMPORT_NOT_IMPLEMENTED`
  has active throw sites; the four removed codes were dead surface.

## [0.14.0] - 2026-05-20

`OntologyBuilder` is now quad-native end-to-end with explicit, labeled entry
points. The canonical internal representation is the rdf/js `QuadInterface`
established in v0.13.0; every output (`jsonLd`, `jsonLdObject`, `shaclObject`)
is derived from that quad store via `JsonLdFormatter.fromQuads`. JSON-LD is
just one input format alongside quads. Consumers choose how data enters but
the internals are uniform.

The README header is also restored to the linked hex-node row that points to
the canonical SVGs under `public/` (Node.js, JSON Schema, TypeScript, json-tology,
RDF, W3C, Validation), matching the assets used on the github pages site.

### Breaking

- `OntologyBuilder.addQuads(quads)` is renamed to `addFromQuads(quads)`.
- `OntologyBuilder.addShacl(jsonLdSource)` and `addShaclQuads(quads)` are
  removed; use `addShaclFromQuads(quads)` or `addShaclFromJsonLd(doc)`.
- `OntologyBuilder.raw()` and the private JSON-LD-stuffed `graphSources`
  config option are removed. The constructor now takes only `baseIRI` and
  `prefixes`; all graph data enters through the `addFrom*` methods.
- `GraphSerializerInterface.serialize(graphs): unknown[]` is removed.
  `GraphOntologySerializer` / `GraphShaclSerializer` expose
  `serializeQuads(graphs): QuadInterface[]` only. Callers that need JSON-LD
  output should feed the quads through `OntologyBuilder.addFromQuads` and
  read `jsonLdObject()`.

### Added

- `OntologyBuilder.addFromQuads(quads)`: append rdf/js quads to the TBox
  store.
- `OntologyBuilder.addFromJsonLd(doc)`: parse a JSON-LD document via
  `jsonld.toRDF` and append the resulting quads to the TBox store.
- `OntologyBuilder.addShaclFromQuads(quads)`: same for the SHACL store.
- `OntologyBuilder.addShaclFromJsonLd(doc)`: same for the SHACL store.
- `OntologyBuilder.quads()`: read back all TBox quads as `QuadInterface[]`
  without round-tripping through JSON-LD.
- `OntologyBuilder.shaclQuads()`: read back all SHACL quads.
- `QuadFactory.fromDatasetQuad(d)`: converts a `jsonld.toRDF` dataset
  quad to the canonical `QuadInterface`.
- `jsonld@^9.0.0` added to `dependencies` (consumers using
  `addFromJsonLd` get the parser without a separate install).

### Changed

- `JsonTology.ontology()`, `toTbox()`, `toShacl()` are rewired to call
  `serializeQuads` on the underlying serializer and pipe through
  `addFromQuads` / `addShaclFromQuads`. The end-to-end data path is
  graph → quads → JSON-LD, never graph → JSON-LD → ad-hoc.
- `README.md` header reverted to the 7-node hex row using the canonical
  `public/*.svg` assets, each linked to its source spec
  (Node.js, JSON Schema, TypeScript, json-tology docs, RDF, W3C, Validation).

## [0.13.2] - 2026-05-20

Publish recovery release. The v0.13.1 CI workflow failed on version-stamped
SVG drift before the package was published. This release bundles the
v0.13.1 documentation accuracy content with correctly stamped SVGs so the
publish workflow completes end-to-end.

All runtime code is identical to v0.13.1.

## [0.13.1] - 2026-05-20

Documentation accuracy follow-up to v0.13.0. The v0.13.0 release notes
advertised `Lists`, `Terms`, and `decodeLiteral` as part of the public API,
but the entries were not actually exported from `json-tology`. This release
adds the missing exports, updates the docs to import them from the public
entry point, and refreshes `ARCHITECTURE.md` to describe the canonical
fold accurately.

### Added

- `Lists`, `Terms`, and `decodeLiteral` are now exported from the top-level
  `json-tology` entry point so consumers can construct rdf/js terms, walk
  RDF lists, and decode literal values without reaching into internal paths.
- `examples/docs/advanced/98-decode-literal-typed-values.ts`: runnable
  example showing `decodeLiteral` recovering number / boolean / string
  values from rdf/js `Literal` terms.
- `examples/docs/advanced/99-lists-build-and-collect.ts`: runnable
  example showing the `Lists.build` → emit → `Lists.collect` round-trip
  for an `sh:or` list.

### Changed

- `docs/advanced/quads.md` rewritten to use `<<<` includes for the new
  runnable examples; the inline `n3.Writer` block carries the required
  `inline-ts-ok` marker per ARCHITECTURE invariant 13.
- `ARCHITECTURE.md` invariant 14 rewritten to describe the canonical
  fold: `QuadInterface = @rdfjs/types#Quad`, `Literal.value: string`,
  `decodeLiteral`, `Lists.build` / `Lists.collect`, and ecosystem interop
  via `Lists.narrowExternalQuads`. The `src/modules/rdf/` file inventory
  is brought current, adding `Lists.ts`, `Terms.ts`, `JsonLdToQuads.ts` and
  dropping the removed `RdfJsQuad.ts` interface entry.

## [0.13.0] - 2026-05-19

`QuadInterface` is now a re-export of `@rdfjs/types#Quad`. There is a single
canonical quad type used both inside json-tology and at every public boundary.
Consumers can pipe `toQuads()` / `toTbox()` / `toShacl()` output directly into
`n3.Writer`, `@graphy/core.data.factory`, `rdf-ext`, `jsonld`, and any other
rdf/js-aware tool with no adapter layer.

### Breaking

- `QuadInterface` is `@rdfjs/types#Quad`. Quads now carry the rdf/js-spec
  `termType: 'Quad'`, `value: ''`, and `equals(other)` method.
- `LiteralTermType.value` is `string` (rdf/js spec). The JS type tag is carried
  in `datatype.value` (`xsd:integer`, `xsd:boolean`, `xsd:dateTime`, etc.).
  Use `decodeLiteral(literal)` from `src/modules/rdf/Terms.ts` to recover the
  typed JS value. `fromQuads`, `Lift`, and the OWL import pipeline call it
  automatically.
- `ListTermType` is removed. RDF lists are emitted as the standard
  `rdf:first` / `rdf:rest` / `rdf:nil` triple chain. The list head (a
  BlankNode or `rdf:nil` IRI) appears in the parent triple's object position.
- `Terms.list()` is removed. Use `Lists.build(items)` (returns `{ head, triples }`
  for the caller to assemble) or `Lists.collect(head, allQuads)` (walks a list
  back into an item array).
- `QuadFactory.rdfList(items, quads)` now takes the surrounding quad array
  as a second argument and pushes the rdf:first/rdf:rest triples into it,
  returning the list head as the object-position term.

### Added

- `@rdfjs/types` as a runtime dependency. Types-only, zero runtime cost, but
  installed alongside `json-tology` so consumers can `import type { Quad } from '@rdfjs/types'`
  with no separate install.
- `Terms.quad(subject, predicate, object, graph?)` factory producing
  rdf/js-spec `Quad` objects with `termType: 'Quad'`, `value: ''`, and
  `equals(other)`.
- `Lists.build(items)` constructs the standard rdf:first/rdf:rest/rdf:nil
  triple sequence; returns `{ head, triples }`.
- `Lists.collect(head, allQuads)` walks a list chain back into an item array.
  Recognises both full IRI (`http://www.w3.org/1999/02/22-rdf-syntax-ns#first`)
  and CURIE (`rdf:first`) predicate forms.
- `Lists.asQuadObject(obj)` narrows an rdf/js `Quad_Object`
  (`NamedNode | Literal | BlankNode | Quad | Variable`) to the project's
  `QuadObjectType` (`NamedNode | BlankNode | Literal`). Returns `undefined`
  for RDF\* quoted triples and SPARQL variables.
- `Lists.narrowExternalQuads(quads)` filters a consumer-supplied `Quad[]`
  down to the project's accepted shape (drops any quad whose terms include
  `Variable` or quoted `Quad`).
- `decodeLiteral(literal)` reverses the rdf/js literal encoding: reads
  `datatype.value` and parses `literal.value` into a typed JS value.
- `JsonLdFormatter` now detects bnode subjects that are heads of
  rdf:first/rdf:rest chains and emits `{ '@list': [...items] }` in the
  JSON-LD output, suppressing the internal list-segment bnodes from the
  top-level node array.
- `test/helpers/listQuad.ts`: test-side helper that returns the parent
  quad + list triples as a single splattable array.

### Changed

- `Terms.literal(value, options?)` stringifies any JS value via
  `String(rawValue)` (Dates use `toISOString()`); the produced Literal
  carries the spec-required `value: string`. When `options.datatype` is
  not provided, the datatype is inferred from the JS type (number → xsd:integer
  or xsd:double, boolean → xsd:boolean, Date → xsd:dateTime, else xsd:string).
  Inputs of the form `{ '@type': 'xsd:...', '@value': X }` are recognised as
  JSON-LD value objects: the `@value` becomes the literal's string value and
  `@type` becomes the datatype IRI.
- `OntologyBuilder.addQuads(quads: QuadInterface[])` accepts rdf/js-spec
  `Quad[]` directly. External quads with `Variable` or quoted `Quad` terms
  are filtered out via `Lists.narrowExternalQuads`.
- All `Terms.equals` signatures accept `null | TermType | undefined` per the
  rdf/js spec. `Terms.quadEquals` accepts `null | Term | undefined`.
- The OWL import pipeline (`ClassAxioms`, `ClassExpressions`, `Datatypes`,
  `Individuals`, `PropertyRestrictions`) walks rdf:first/rdf:rest chains via
  `Lists.collect` and decodes literals via `decodeLiteral` so typed JS values
  round-trip correctly.
- `extractListItems` in `ClassExpressions` and `Datatypes` walks the rdf list
  via the subject quad index; legacy single-item passthrough is preserved for
  inline blank nodes that are not list heads.
- `equivalentClass` import accepts three encodings: direct NamedNode IRI, a
  BlankNode wrapping `owl:unionOf [...]` (the shape OwlProjection emits), and
  the legacy serialised-Literal form.

## [0.12.2] - 2026-05-19

Lint zero-baseline follow-up to v0.12.1.

### Fixed

- `examples/docs/constraint-brands/08-named-format-brands.ts`: `sendEmail` and `trackEvent` were declared as functions whose `_to` / `_id` parameters carried the leading-underscore convention to mark them unused. The `@typescript-eslint/naming-convention` rule forbids the leading-underscore pattern on functions, so the example is restructured as `SendEmailFn` / `TrackEventFn` type aliases that preserve the original "brand types are not assignable from plain string" demonstration.

### Internal

- `eslint.config.mjs` already widened `varsIgnorePattern` / `argsIgnorePattern` from `^_$` (exact single underscore) to `^_` (starts with underscore) in v0.12.1; this release just finishes the trailing example-file restructure that the lint sweep agent surfaced.

## [0.12.1] - 2026-05-19

Tech-debt pass. No new features, no breaking changes.

### Added

- `scripts/ensure-built.mjs` + `pretest` / `pretest:smoke` / `pretest:e2e` / `pretest:all` lifecycle hooks. Cold `npm run test:all` from an empty `dist/` now builds once before any tier runs and 2228 / 2228 tests pass without the smoke tier racing the e2e tier's mid-suite `npm run build` invocation.
- Three new canonical-location interface files (`src/interfaces/OwlImport.ts` carries `OwlImporterOptions`; new `src/interfaces/OwlCodegen.ts` carries `OwlCodegenOptions` / `RegistryFileEntry` / `RegistryFilesResult` / `OwlRegistryDirOptions`; new `src/interfaces/OwlGen.ts` carries `GenerateFromTboxOptions` / `GenerateRegistryDirectoryOptions` / `GenerateRegistryDirectoryEntityFile`). Interfaces previously declared inline in `src/modules/ontology/OwlImporter.ts`, `src/modules/codegen/OwlCodegen.ts`, and `src/owl-gen.ts` are now re-exported from their canonical location per the CLAUDE.md code-organization rule.
- ARCHITECTURE invariants 14 to 17 codify the rdf/js Term-based `QuadInterface`, strict-by-default registry posture, the one-pipeline OWL importer contract, and the codegen one-way build-step contract.
- README links to the OWL importer + codegen docs page and documents the optional `jsonld` peer dependency.
- `docs/cli.md` documents the `owl-gen` subcommand (single-file and registry-directory modes).

### Changed

- `test/e2e/cli.test.ts` no longer invokes `npm run build` from its `before()` hook (it asserts `dist/cli.js` exists, and the lifecycle hook guarantees that).
- `src/modules/ontology/OwlImporter.ts` and `src/modules/graph/QuadBackedSchemaGraph.ts` had their class-field declarations reordered so V8 builds a monomorphic shape on first instantiation.
- `examples/docs/benchmarks/results/latest.md` regenerated; now carries OWL import (`~1.9k ops/s` bookstore TBox), OWL codegen (`~1.4k ops/s`), and OWL codegen directory (`~5.9k ops/s`) scenarios. Earlier scenarios refreshed against the current code.

### Fixed

- Duplicate `## [0.6.0] - 2026-05-14` heading in CHANGELOG.md collapsed.
- `docs/advanced/owl-import.md` no longer includes `90-owl-import-roundtrip.ts` twice in the same section.
- `CONTRIBUTING.md` release-workflow steps now describe the two-workflow split correctly: `publish.yml` handles npm + GPR publishing, `release.yml` fires on `v*` tag push to create the GitHub release.

### Internal

- Stash hygiene: three stale stashes from earlier recovery work purged.
- Branch hygiene: 24 merged or worktree-agent branches deleted; only `main` remains locally between releases.

## [0.12.0] - 2026-05-19

`owl-gen` now generates a full registry directory: one `entities/<Name>.ts` per OWL class plus an `index.ts` that mirrors the canonical bookstore layout.

### Added

- **CLI registry-directory mode**: `--out foo/` (no `.ts` suffix) or `--mode directory` flag on `owl-gen` triggers directory emission; `--out foo.ts` preserves existing single-file behaviour.
- **`generateRegistryDirectory(options)`** programmatic API in `json-tology/owl-gen`: writes `entities/<Name>.ts` + `index.ts` to `outDir`, returns entity file metadata.
- **`generateRegistryFiles(result, options)`** pure in-memory function in `src/modules/codegen/OwlCodegen.ts`: returns entity file sources + `indexSource` without touching the filesystem; shared core used by both single-file and directory modes.
- **`examples/docs/ontologies/generated-dir/foaf/`**, **`dcat/`**, **`schema-org/`**: committed registry-directory fixtures for each of the three real-ontology subsets; produced by `npm run regen:ontology-fixtures`.
- **`examples/docs/advanced/95-foaf-registry-dir.ts`**, **`96-dcat-registry-dir.ts`**, **`97-schema-org-registry-dir.ts`**: runnable round-trip examples for registry-directory mode.
- **`examples/docs/benchmarks/owlCodegenDir.bench.ts`**: `generateRegistryFiles` throughput benchmark for bookstore TBox and minimal 3-class ontology.
- **`docs/advanced/owl-import.md`** extended with a `## Generating a full registry directory` subsection covering CLI invocation, programmatic API, a `<<<` include of the FOAF registry-dir example, and entity file ↔ canonical bookstore symmetry notes.

## [0.11.1] - 2026-05-19

Real-ontology codegen round-trip examples for FOAF, DCAT-AP, and schema.org.

### Added

- **`examples/docs/ontologies/foaf-subset.jsonld`**: hand-authored FOAF subset: `foaf:Agent`, `foaf:Person`, `foaf:Group` classes; `foaf:name`, `foaf:mbox`, `foaf:knows`, `foaf:member` properties; `owl:disjointWith` between Person and Group; `rdfs:label`/`rdfs:comment` annotations.
- **`examples/docs/ontologies/dcat-subset.jsonld`**: hand-authored DCAT-AP subset: `dcat:Dataset`, `dcat:Distribution`, `dcat:Catalog` classes; `dcat:title`, `dcat:description`, `dcat:distribution`, `dcat:accessURL` properties; `rdfs:subClassOf` chain reaching `dcterms:Resource` as an external IRI stub.
- **`examples/docs/ontologies/schema-org-subset.jsonld`**: hand-authored schema.org subset: `schema:Book`, `schema:Person`, `schema:Organization` classes; `schema:author`, `schema:publisher`, `schema:name`, `schema:isbn` properties; `schema:IsbnType` declared as `rdfs:Datatype` with XSD pattern facet (`^\d{13}$`) that round-trips losslessly.
- **`examples/docs/ontologies/generated/foaf.generated.ts`**, **`dcat.generated.ts`**, **`schema-org.generated.ts`**: committed generated TypeScript fixtures produced by `generateFromTbox`. Consumers can inspect the codegen output without running the generator themselves.
- **`scripts/regen-ontology-fixtures.mjs`**: maintainer script to refresh the committed generated fixtures after codegen format changes. Not wired into CI. Run via `npm run regen:ontology-fixtures`.
- **`examples/docs/advanced/92-foaf-roundtrip.ts`**, **`93-dcat-roundtrip.ts`**, **`94-schema-org-roundtrip.ts`**: runnable round-trip examples demonstrating `fromTbox → generateFromTbox → validate → InferType` against each real ontology fixture.
- **`docs/advanced/owl-import.md`** extended with a `## Real-ontology round-trip examples` section, one subsection per ontology with `<<<` includes for the input fixture, generated TypeScript, and runnable example.
- `npm run regen:ontology-fixtures` script wired into `package.json`.

## [0.11.0] - 2026-05-19

Compile-time TypeScript types for imported OWL 2 ontologies via code generation.

### Added

- **`json-tology owl-gen <input> --out <file>`** CLI subcommand. Reads an OWL 2 JSON-LD ontology, runs it through `JsonTology.fromTbox`, and emits a TypeScript source file with `as const` schema literals + a registered registry constant + `InferType`-backed per-class type aliases. Standard build-step usage: `prebuild` hook, vite plugin, husky pre-commit.
- **`generateFromTbox(options)` programmatic API** exported from the new `json-tology/owl-gen` subpath. Same surface as the CLI, callable from build scripts. Returns the source string when `output` is omitted; writes to disk when provided.
- **`src/modules/codegen/OwlCodegen.ts`**: pure `generateTypeScript(result, options)` function with topological dep-sort, IRI → PascalCase name derivation, collision detection with `_2` suffix, sameAs / `addCharacteristic` emission, and skip-filter for internal JSON-pointer scaffolds (`urn:x:Class#/allOf/1/if`).
- New runnable example `examples/docs/advanced/91-owl-codegen-generated.ts` demonstrating the codegen → write-to-disk → re-import → `InferType` round-trip in a single file. Two new bench scenarios in `examples/docs/benchmarks/owlCodegen.bench.ts` (bookstore TBox + minimal 3-class).
- Docs page `docs/advanced/owl-import.md` extended with a `## Compile-time types via codegen` section covering CLI usage, programmatic API, and build-time integration patterns.

### Changed

- **`OwlProjection`** (forward path) now emits primitive scalar schemas (`type: 'number'`, `'string'`, `'integer'`, `'boolean'`) as `rdfs:Datatype` declarations with `owl:onDatatype` (XSD base) + `owl:withRestrictions` (facets) + `jt:format` / `jt:multipleOf` annotations, instead of emitting them as `owl:Class`. Fixes lossy round-trip of bookstore primitives (Amount, Email, Isbn, etc.).
- **`Datatypes` importer dispatcher** handles `jt:format`, `jt:multipleOf`, and the full XSD scalar set (`xsd:date`, `xsd:dateTime`, `xsd:duration`, `xsd:time` added).
- **`OwlImporter` orchestrator** collects custom `rdfs:Datatype` IRIs into `ctx.isDatatype()` so property-range lookups against custom datatypes no longer surface as `OWL_IMPORT_NOT_IMPLEMENTED`.
- **`JsonLdToQuads`** distinguishes plain string literals (`"email"`) from IRI references and handles inline blank-node restriction facets that `JsonLdFormatter` strips `@id` from.
- **`test/integration/owlRoundTrip.test.ts`** strengthened: every bookstore primitive schema is now asserted structurally equal via `deepStrictEqual` after `fromTbox(toTbox(s).jsonLd())`. 33/33 scalar primitives + 62 total schemas round-trip losslessly.

## [0.10.1] - 2026-05-19

Graph inspector moved below the canvas as a two-column in-flow panel.

### Fixed

- `BookstoreGraph` node inspector no longer overlays the graph canvas. The panel now renders below the Cytoscape container as a full-width in-flow element.
- Graph canvas contracts (720 px → 460 px) with a smooth height transition when a node is selected; expands back on dismiss. The existing `ResizeObserver` fires on the `graph-wrapper` height change, triggering `cytoscape.resize()` + `fit()` so the graph re-centres automatically.

### Changed

- Inspector layout redesigned as a two-column grid: **RDF** (left) lists all edges/relations for the selected node; **JSON Schema** (right) renders the registered schema as a pretty-printed scrollable block.
- Each column body is capped at 240 px (`max-height`) with `overflow-y: auto` (~16 visible lines).
- On viewports ≤ 720 px the two-column grid stacks into a single column.
- Inspector header shows the local IRI label as a `<strong>` heading, the full IRI in a `<code>` element below it, and a dismiss button (`✕`) at the far right.
- Clicking the graph background or the dismiss button both close the inspector (unchanged behaviour).

## [0.10.0] - 2026-05-18

OWL 2 TBox importer: `fromTbox` / `JsonTology.fromTbox`.

### Added

- **`JsonTology.fromTbox(jsonLd, options)`:** static helper that reads an OWL 2 TBox (JSON-LD string, compact JSON-LD object, or `QuadInterface[]`) and returns an `OwlImportResult` with reconstructed JSON Schema objects for every declared class, along with invariants, property characteristics, `owl:sameAs` pairs, and named individuals. Uses a transient `OwlImporter` with no registry side-effects.

- **`jt.fromTbox(jsonLd, { register? })`:** instance method equivalent. When `register: true` (the default), all produced schemas are passed to `registry.set()`, invariants and characteristics are applied, and `sameAs` pairs are stored, making the imported vocabulary immediately available for `validate()` / `instantiate()` / `materialize()` calls.

- **`OwlImporter`:** public class (exported from `json-tology/ontology`) that orchestrates the OWL 2 import pipeline. Constructs once and accepts multiple `import()` / `importAsync()` calls. Stateless across calls.

- **`OwlImportError`:** error class thrown when a dispatcher encounters a fatal import condition. Carries `axiomIri` and `subjectIri` for diagnostics. Code values: `OWL_IMPORT_ERROR`, `OWL_IMPORT_NOT_IMPLEMENTED`.

- **`OwlImportResult`** interface: shape returned by both `fromTbox` variants. Fields: `schemas`, `invariants`, `characteristics`, `sameAs`, `individuals`, `unsupported`.

- **Eight axiom dispatchers** under `src/modules/ontology/importDispatch/`:
  - `ClassAxioms`: `owl:Class`, `rdfs:subClassOf`, `owl:equivalentClass`, `owl:disjointWith`, `owl:complementOf`, `owl:disjointUnionOf`
  - `ClassExpressions`: `owl:intersectionOf`, `owl:unionOf`, anonymous class expression nodes
  - `PropertyRestrictions`: `owl:Restriction` with `owl:someValuesFrom`, `owl:allValuesFrom`, `owl:minCardinality`, `owl:maxCardinality`
  - `Properties`: `owl:ObjectProperty`, `owl:DatatypeProperty` with `rdfs:domain` / `rdfs:range` → JSON Schema `properties` entries
  - `Characteristics`: `owl:FunctionalProperty`, `owl:InverseFunctionalProperty`, `owl:TransitiveProperty`, `owl:SymmetricProperty`, `owl:AsymmetricProperty`, `owl:ReflexiveProperty`, `owl:IrreflexiveProperty`
  - `Datatypes`: `owl:oneOf` enumerations → `enum`, XSD datatype range mapping
  - `Individuals`: `owl:NamedIndividual`, `rdf:type` assertions, data/object property assertions
  - `Annotations`: `owl:sameAs`, `rdfs:subPropertyOf`

- **Round-trip contract**: `fromTbox ∘ toTbox ≈ identity` on the supported OWL 2 axiom set. A TBox exported by `jt.toTbox()` re-imports with zero `unsupported` entries. Primitive type facets (XSD constraints like `minLength`, `minimum`, `format`) are not encoded in OWL class axioms and are not restored.

- **`docs/advanced/owl-import.md`**: new docs page covering the `fromTbox` API, supported axiom table, limitations, and the round-trip fidelity contract.

- **`examples/docs/advanced/90-owl-import-roundtrip.ts`**: runnable example demonstrating the full import pipeline against the canonical bookstore TBox.

- **Tests**:
  - `test/integration/owlRoundTrip.test.ts` (renamed from `owlRoundTripScaffold.test.ts`): full bookstore round-trip with `structurallyEqual` helper; replaces the Phase 0 `it.skip`.
  - `test/e2e/realWorldOntologyImport.test.ts`: in-line FOAF and DCAT-AP fixtures, validates imported schemas and runs `validate()` against hand-crafted instances.
## [0.9.2] - 2026-05-18

OG card and README header visual fix.

### Fixed

- **OG card cluster (`docs/public/og-image.svg.template`):** replaces the abstract color-coded hexes with letter labels (TS / JSON / VAL / RDF / W3C / NODE) with the actual seven node SVGs from `docs/public/nodes/`, matching the HexRing component shown in the docs-site sidebar. The center hex is now the teal JST glyph instead of a red placeholder.
- **README header cluster (`docs/public/readme-header.svg.template`):** same fix at compact scale (imgSize=78). Social previewers and the GitHub social-preview image now match the live docs site.
- Both templates inline each node SVG body directly with per-node id and CSS-class prefixes (`jst-`, `ts-`, `json-`, `val-`, `rdf-`, `w3c-`, `node-`) to prevent gradient and filter id collisions. HexRing geometry (visualW = imgSize × 304.8/400, visualH = imgSize × 352/400, six ring offsets) is reproduced exactly.

## [0.9.1] - 2026-05-18

Docs and release-pipeline polish.

### Added

- **Versioned README header.** Replaces the static node-ring banner with a brand-styled 7-cluster hex SVG that carries the current release version in a pill beside the wordmark. The SVG is referenced via `raw.githubusercontent.com` so it renders on the README on GitHub and inside release-note bodies. The 7-cluster matches the sidebar `HexRing` motif on the docs site so the social-preview card, the GitHub README banner, and the live site share one visual identity.
- **`docs/public/og-image.svg.template`** + **`docs/public/readme-header.svg.template`**: version-stamped sources for the social preview and the README header. Both render the 7-cluster + a version pill that reads the current `package.json#version`.
- **`scripts/stamp-version.mjs`** reads `package.json#version` and stamps every `docs/public/*.svg.template` into its sibling `.svg` with the current version. `--check` flag is the CI drift guard wired into `publish.yml`'s validate step. The stamp runs automatically before `docs:build` via `predocs:build`.
- **Release-publish workflow** (`.github/workflows/release.yml`). Fires on any `v*` tag push: verifies each stamped SVG matches the tag, extracts the matching `## [<version>]` section from `CHANGELOG.md`, and creates or updates the GitHub release with a body that embeds the per-tag stamped SVG URL. Historical release pages render the version that was stamped at tag time rather than always-latest. Supports `workflow_dispatch` for manual republish.

### Changed

- **`docs/.vitepress/theme/components/BookstoreGraph.vue`** runs the fcose layout synchronously and calls `fit()` in the same tick as the cytoscape render, so the first paint already shows the laid-out graph instead of clustered pre-layout positions. The previous `cyInstance.one('layoutstop', ...)` + `setTimeout(refit, 250)` race-window workaround is gone.

## [0.9.0] - 2026-05-18

### Breaking

- **`SchemaRegistry` defaults flipped to strict-by-default.** `enableStrictGraph`, `enableInlineWarnings`, and `enableDuplicateDetection` now default to `true`. Registering an inline primitive constraint or a structural duplicate of an already-registered schema raises `SchemaError` (`SCHEMA_STRUCTURE_INVALID` / `SCHEMA_DUPLICATE_SHAPE`) at registration time. Pass `'enableStrictGraph': false` to `JsonTology.create({...})` or `new SchemaRegistry({...})` to restore the historical permissive behaviour.

- **`QuadInterface` now uses rdf/js Term objects.** The `subject`, `predicate`, and `graph` fields changed from bare strings to `IriTermType | BnodeTermType | DefaultGraphTermType` per the rdf/js data-model spec. Consumers reading IRI strings must access the new `.value` property: `quad.subject.value` instead of `quad.subject`. The `graph` field is now non-optional (defaults to the singleton `DefaultGraph` term). Use `Terms.iri(...)` / `Terms.blank(...)` / `Terms.literal(...)` / `Terms.defaultGraph()` to construct terms.

- **`RdfJsQuadInterface` removed.** External rdf/js quads now interoperate directly through the updated `QuadInterface`; the legacy bridge type and `Lift.fromQuad` adapter are gone. Use `Lift.fromExternalQuad(rdfQuad)` for adapters that normalise non-prefixed quads coming from external libraries.

### Library

- Added `JsonSchemaDocumentType`: a structural Draft-2020-12 schema document type (ported from nocturne and extended with json-tology's OWL property characteristics, class axioms, and `jt:*` directives). Replaces `JSONSchema7Definition` from the upstream `json-schema` package as the constraint for every public-API generic (`jt.materialize<TSchema>`, `jt.instantiate<TSchema>`, `Transform.create<TSchema>`, etc.). Schemas declaring `$schema: 'https://json-schema.org/draft/2020-12/schema'` or using post-Draft-07 keywords (`prefixItems`, `unevaluatedProperties`, `dependentSchemas` as a keyword) now satisfy the constraint.
- Added `jt.addTransform<TSchema, TOut>(schema, fns)`: registry-aware variant of static `Transform.create`. Decode/encode lambda parameter types resolve through `InferSchemaType<TSchema, TSchema, TMap>` so cross-registry `$ref`s (e.g. `{ $ref: 'urn:bookstore:Customer' }` inside a wrapping schema) infer to the full referenced entity rather than `unknown`.
- Added `Compose.subClassOf` / `Compose.extend` allOf-parent property propagation on `instantiate`. The compiler's `allowedKeysForStrip` now unions own properties with allOf-inherited keys (recursively, resolving cross-graph `$ref`), so coercion no longer silently drops parent fields from a subclass schema. The strict `additionalProperties: false` validation error continues to use the own-only set per JSON Schema semantics. The materializer walks the same effective-property set so `fillImplicitProperties` populates parent slots that were missing from the input.

### Tooling

- Added `@types/n3` as a devDependency for rdf/js typing across the ontology and SHACL serialization modules.

### Docs / examples

- The canonical bookstore at `examples/docs/bookstore/` is now the single source of truth for every docs page, example file, and benchmark scenario.
  - Dropped `SoloAuthoredBookSchema` and `AnthologyBookSchema` as registered schemas. Single-authorship is a cross-field rule on `Book.authors`, not a distinct OWL class. The new `signedFirstEditionIsSoloAuthored` invariant on `SignedFirstEditionSchema` enforces it through `ValidationErrors` with `keyword: 'jt:invariant'`.
  - Added `PrintStatusSchema` primitive (`'inPrint' | 'outOfPrint' | 'limitedRun'`). `Book.printStatus` is required. `InPrintBookSchema` / `OutOfPrintBookSchema` discriminate on publisher state (`printStatus`) rather than inventory state (`inStock`), so a book can be in stock and out of print at the same time.
  - `SignedFirstEditionSchema` simplifies to single-parent `subClassOf(RareBook)` plus the registered invariant.
  - Concrete instances live in `examples/docs/bookstore/aboxFixtures.ts`: customer Bastian Balthazar Bux orders a rare 1979 Thienemann first edition of Michael Ende's *Die unendliche Geschichte* (ISBN 9783522128001). Two `owl:sameAs` pairs (customer-migration + cross-catalog book) thread through the docs.
  - Every example file imports `bookstoreEntities` directly; no mini-registries; derived schemas (`Compose.pick`/`omit`/`extend`/`partial`/`required`/`intersection`/`discriminatedUnion`/`equivalent`) register via `bookstoreEntities.set()`. Every fixture name is a real author (Michael Ende, Cornelia Funke, Walter Moers, Hermann Hesse, Patrick Süskind) or a Neverending Story character (Bastian Balthazar Bux, Carl Conrad Coreander). All ISBNs are real. Pronouns referring to fixture personas are gender-neutral.
  - New example directories: `examples/docs/types/`, `examples/docs/schemas/`, `examples/docs/usage-examples/`, `examples/docs/getting-started/`, `examples/docs/picking-a-method/`, `examples/docs/argument-conventions/`. Existing scopes filled in for composition, computed, invariants, transforms, value, serialization, validation, materialization, registry.
  - New tests: `test/smoke/bookstoreFixtures.test.ts` validates every fixture against its schema and proves the invariant fires; `test/types/bookstore-axioms.test.ts` pins every OWL axiom at compile time via `AssertEqualType`.
- Phase 3 docs conversion completed: every inline `\`\`\`ts` block across `docs/**/*.md` is now either a VitePress `<<<` include against a runnable file in `examples/docs/`, an explicitly-marked exemption (`<!-- inline-ts-ok: <reason> -->` for `.d.ts` module augmentation, pseudocode signatures, type-shape illustrations that can't be runnable code), or lives in a historical/meta file (`docs/migration-*.md`, `docs/example-suite-plan.md`, `docs/resume-handoff.md`). The ratchet at `scripts/check-docs-includes.mjs` now enforces a ceiling of **zero** inline blocks under the new exemption rules. Total: 480 runnable example files under `examples/docs/`.
- Smoke suite `test/smoke/docExamples.test.ts` rewritten to register per-section describes from a synchronous scan, so all 480 example files are now individually verified to import without throwing. Tests run before: 1704 → after: 2002.
- Bookstore registry exports `bookstoreSchemas` (the readonly schema array used to construct `bookstoreEntities`). An example that needs a relaxation (e.g. `enableTypeCast: true` to demonstrate coercion) seeds a separate registry from `bookstoreSchemas` rather than mutating the canonical one.
- Documented the example-suite contract as invariant #13 in `ARCHITECTURE.md`.
- SEO stack: OG / Twitter Card meta tags, JSON-LD structured data, and favicon variants added to the docs site.
- WCAG 2.1 AAA palette applied to the docs site. `npm run build:palette` generates the palette CSS from the source token file.

## [0.8.0] - 2026-05-15

### Added

- `SchemaRegistry.graphEntry(id)` returns `{ schema, graph }` in a single lookup. Used by `Dumper` to collapse two sequential `resolve() + store.get()` round-trips into one.
- `SchemaRegistry.instantiate` / `cast` / `convert` accept an opt-out `clone: false` flag. Used internally by `Materializer` on engine-output paths where ownership is already local.
- `hasEmbeddedIds` and `hasComputedFields` flags on `SchemaRegistryEntryInterface`, computed once at registration. Drive sentinel + flag-gated fast paths in `engine()` and `instantiate()`.

### Performance: production "build once, reuse many"

- `discriminated union` +58% vs 0.7.0; `extend + validate` and `intersection` corrected from measurement artifacts to steady-state 1.89M and 2.18M ops/s; `dumpJson nested` +41% via no-transform fast path; broad +2-5% across validate/coerce/clean/diff/encode paths.
- `GraphEngine.cachedDefaultResolutionContext` and `cachedVisitContext` are constructor-built `private readonly` fields. The 12-closure visit context and the two-closure default-resolution context are no longer allocated per call.
- `Materializer` precomputes `cachedOverridesWithDefaults` and `cachedOverridesNoDefaults` as instance fields. `run()` selects with a ternary instead of building a fresh 6-field overrides object.
- `JsonTology.graphSchemaSerializer` is a `private readonly` instance field (matches the `ontologySerializer` / `shaclSerializer` pattern). `new GraphSchemaSerializer()` per `toSchema()` is gone.
- `SchemaRegistry.lookupGraph` is a `private readonly` constructor-bound field. `engine()` builds options via direct field assignment instead of three nested object spreads.
- `Curie.expand` memoizes prefix expansion. Cache valid for the Curie's lifetime; prefixes are constructor-injected and immutable.
- `engine()` returns a frozen `EMPTY_EMBEDDED_MAP` sentinel when `entry.hasEmbeddedIds === false`. `instantiate` skips the `computedStore.getMap` round-trip when `entry.hasComputedFields === false`.
- `SchemaCompilerPlan` hoists module-scope `ALWAYS_TRUE_CHECK`, `ALWAYS_FALSE_CHECK`, `TRUE_VALIDATOR`, `FALSE_VALIDATOR` singletons. Boolean-schema compile paths reference the singletons instead of allocating fresh `() => true` / `() => false` per call.
- `SchemaCompilerPlan` replaces `[...sem.allOf, ...sem.anyOf, ...sem.oneOf]` with three sequential `for...of` loops in `nodeSupportsCompilation`.
- `SchemaCompilerPlan` flat-object fast path uses `Map.has` and `Array.includes` directly instead of materializing per-compile Sets.
- `Predicates.satisfiesFormat` removed. The try/catch wrapper exited V8 JIT optimization and the validator call site was polymorphic. Built-in format validators are now invoked directly; user-supplied validators that throw are caught at the single boundary in `Scalars.validateFormat`.
- `Dumper.dumpJson` short-circuits to `JSON.stringify(value)` when the schema has no registered transform decoders and the options carry no active filters.
- `Dumper.dumpObject` allocates the `knownKeys` Set only when `excludeDefaults === true`.
- `VisitComposition` lazy-initializes `evaluatedProperties` / `evaluatedItems` / `successfulResults`. Six `{ ...options, collectErrors: true }` per-branch spreads collapsed to one pre-allocated `collectErrorsOptions` per call across `anyOf` / `oneOf` / `ifThenElse` / `not`.
- `VisitComposition.oneOf` caches per-variant semantic descriptors in a module-scope `WeakMap` keyed on the oneOf node array.
- `RefDecoder.walkAdditionalProperties` calls `semantics.properties.has(key)` directly on the Map instead of allocating a fresh Set from `.keys()`.
- `GraphEngine.validateObject` uses a single `propertyNodeMap.get(key)` + undefined check instead of `has(key)` then `get(key)`.
- `GraphEngine.validateArray` uniqueItems uses a labeled inner loop scanning from `index + 1` instead of allocating a `.slice(index + 1)` per element.
- `GraphEngine` hoists a module-scope `escape` alias for `SchemaGraphSupport.escapeJsonPointerSegment`, eliminating six static-method-call paths inside per-property loops.
- `GraphEngineDefaults.createImplicitDefaultValue` / `synthesizeZeroValue` split into public wrappers that own the single `Set<string>` cycle-guard allocation and internal recursive workers that take `visited` as a required parameter.
- `Lift.findPropertyQuads` consumes a per-subject predicate index built once per `liftSubject` call when the subject has more than 3 properties, replacing two per-property `.filter()` passes with Map lookups.
- `JsonLdFormatter` blank-node inlining uses a single-pass copy that skips `@id` during construction (no spread + delete).
- `Skolemize` UUID fallback uses a 256-entry hex lookup table instead of `toString(16).padStart(2, '0')` per byte.
- `SchemaGraphRelations.pushDependentRequiredRelations` iterates `Object.entries` with a length guard instead of `.filter().forEach()`. `extractRelations` computes `nonNullTypes` once and shares it across `pushPropertyTypeRelations` and `pushUnionTypeRelations`.
- `Compose.extend` constants `EXTEND_SKIP_KEYS` and `CLASS_AXIOM_BODY_SKIP_KEYS` hoisted to `src/constants/COMPOSITION.ts`.

### Bench

- `intersection` and `extend + validate` benchmarks corrected to measure steady-state validate, not registry construction. Previous loops allocated `new SchemaRegistry()` per iteration, measuring graph lowering + compile + validate as one operation. Production callers warm the registry once.

### Internal

- 2 inline interfaces moved to `src/interfaces/` (`RefDecoderRegistry`, `FetchLoaderOptions`).
- 8 module-scope constant clusters relocated to `src/constants/` (`COMPOSITION`, `STRUCTURAL_HASH`, `SCHEMA_KEYWORDS` appended with `PRIMITIVE_CONSTRAINT_KEYWORDS` and `PRIMITIVE_TYPES`, `XSD_MAPS` appended with `XSD_COERCERS`, `ONTOLOGY_PREDICATES` appended with `CARDINALITY_KINDS`, `SIMPLE_LITERAL_PREDICATES`, `IRI_PREDICATES`).
- 4 schema-keyword constants added to `src/constants/SCHEMA_KEYWORDS.ts` (`ID_KEYWORD`, `REF_KEYWORD`, `DEFS_KEYWORD`, `SCHEMA_KEYWORD`).
- `ARCHITECTURE.md` rebuilt with current public API surface and file inventory (214 files enumerated across all modules).

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
- `FormatRegistry` built-in validators no longer wrap each inner function in a `(value) => typeof === 'string' && fn(value)` closure. Type guards are inlined; call site is monomorphic.
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

### Added

- `JsonTology.prefetch({ loader, schemas?, rootIds?, baseIRI? })` walks transitive `$ref` IRIs via a loader and returns a `SnapshotInterface { version: 1; schemas: ReadonlyMap<string, JsonSchemaType>; provenance? }` keyed by `$id`. Throws `GraphError('REF_UNRESOLVED')` when the loader returns `null` for a required IRI; loader-thrown errors propagate.
- `prefetched?: SnapshotInterface` option on `JsonTology.create`. Schemas passed via `schemas` register first; entries from the snapshot then fill any IRIs not already in the registry. `schemas` wins on collision.
- `SchemaRegistryInterface` mirrors the surface of a native `Map<string, Schema>`. Reads: `has`, `get`, `keys`, `values`, `entries`, `forEach`, `size`, `[Symbol.iterator]`. Writes: `set(schema, iri?)` and `set([schema | [schema, iri], ...])` (schema-first ordering, replace on collision per `Map.set`), `delete(iri)` (returns boolean), `clear()`.
- `SchemaRegistryInterface.revision`: monotonic counter bumped on every mutation. Drives the ontology cache and is available for external consumers that cache derived views.
- `SnapshotInterface`, `SnapshotProvenanceInterface`, and `PrefetchOptionsInterface` exported from `json-tology/interfaces`.
- Docs: `/comparisons`: capability matrix across 11 comparator libraries (Zod, Valibot, TypeBox, AJV, Pydantic, Yup, Joi, io-ts, Effect Schema, ArkType, Runtypes).
- Docs: `/benchmarks`: per-scenario in-browser runner. Every scenario shows the source code (via vitepress includes), a Run-in-browser button that loads each comparator from its esm.sh CDN entry on demand (json-tology imports from local `src/` via Vite alias so the page measures HEAD), and the canonical Node-side results. Every library has a row in every scenario; where a library lacks a primitive the row runs the userland equivalent the library's consumers would actually write.
- The bench suite now lives at `examples/docs/benchmarks/` as runnable examples linked to GitHub source. `npm run bench:report` writes the consolidated `results/latest.md` and per-scenario fragments under `results/scenarios/`.

### Changed

- **BREAKING**: `JsonTology.create` is synchronous on every call site. The `loader` option is removed from `JsonTologyOptionsInterface`. Async transitive resolution lives entirely in `JsonTology.prefetch`. Migration: replace `await JsonTology.create({ loader, schemas })` with `const snapshot = await JsonTology.prefetch({ loader, schemas }); JsonTology.create({ prefetched: snapshot, schemas })`.
- **BREAKING**: `register` is renamed `set` on `SchemaRegistryInterface`, `JsonTology`, and `FormatRegistryInterface`. The merged write surface takes the schema first, with an optional explicit key as the second argument: `set(schema)`, `set(schema, iri)`, or `set(entries[])` where each entry is either a schema or a `[schema, iri]` tuple. `JsonTology.set` widens `TMap`. `FormatRegistry.set(name, validator)` keeps Map's `(key, value)` ordering (no schema involved). Semantics shift: `set` replaces silently per `Map` contract; the previous `register`-with-different-content throw is gone.

### Removed

- **BREAKING**: `jt.registerAsync(schema)` is gone. Federation runs through `JsonTology.prefetch` only; `jt.set(schema)` remains for sync registration of schemas whose refs are already resolved.
- **BREAKING**: `jt.has(iri)`, `jt.get(iri)`, and `jt.list()` facade methods removed. There is one path to registry reads: `jt.registry.has(iri)`, `jt.registry.get(iri)`, `[...jt.registry.keys()]`. The registry exposes the full Map-like read surface.
- **BREAKING**: `register()` removed from `SchemaRegistryInterface`, `JsonTology`, and `FormatRegistryInterface`. Replaced by `set` (see Changed). `registerAnonymous` stays because it generates a hash key, a distinct verb from `Map.set`.

### Security

- npm overrides force `vite` to `^6.4.2` and `esbuild` to `^0.25.0` to resolve [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) (vite path traversal in optimized deps `.map` handling) and [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (esbuild dev server request smuggling). Both surfaces are dev-only (vitepress docs build); production bundles unaffected.

## [0.5.0] - 2026-05-13

### Added

- `LoaderType = (iri: string) => Promise<JsonSchemaType | null>`: pluggable async schema-fetch hook exported from `json-tology/types`.
- `Loaders` namespace (exported from `json-tology`) with four universal helpers: `Loaders.fetch({ base?, init? })` (uses `globalThis.fetch`, works in Node ≥ 18, Bun, Deno, browsers), `Loaders.compose(...loaders)` (first non-null wins), `Loaders.cached(loader, { maxSize? })` (LRU, default 1024, caches null too), `Loaders.memory(map)` (in-memory lookup for tests / bundled schemas). No Node-only built-ins, zero new runtime dependencies.
- `loader?: LoaderType` on `JsonTologyOptionsInterface`. When provided, `JsonTology.create()` returns `Promise<JsonTology>` and eagerly resolves all transitive `$ref` IRIs before yielding a fully-warmed instance. If the loader returns `null` for a required IRI, throws `GraphError('REF_UNRESOLVED')` with the IRI. Without a loader the existing sync API is unchanged.
- `jt.registerAsync(schema)`: post-construction async registration that walks transitive refs via the configured loader. Requires a loader at construction time.
- Docs: `docs/advanced/schema-federation.md`: how the loader hook integrates with `$ref` resolution, write-your-own loader examples, performance notes, error handling, comparison with AJV `loadSchema` and SPARQL `SERVICE`.
- Docs: `docs/advanced/browser-usage.md`: universal (CDN, bundler, Node) usage guide using the loader hook as the central federation primitive. No environment-specific export paths.

### Removed

- **BREAKING**: `SchemaLoader` class (`src/modules/registry/SchemaLoader.ts`): the Node-only file reader was the sole reason for any browser/node conditional export complexity. Migration: read the JSON file yourself with `node:fs` and pass the parsed schemas to `JsonTology.create({ schemas: [...] })`, or supply `loader: async (iri) => { const content = await fs.promises.readFile(path); return JSON.parse(content); }` to resolve on demand.
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
- Docs IA: 7 reference pages split for scope. `types.md` → `types/{infer,utility,ranges}.md`; `constraint-brands.md` → `constraint-brands/{keywords,narrowing}.md`; `bookstore-domain.md` → extracted OWL taxonomy to `usage-examples/bookstore-owl-taxonomy.md`; `advanced/graph-concepts.md` → `graph-concepts.md` (fundamentals) + `graph-internals.md` (implementation); `schemas.md` deduplicated against registry pages (673 → 176 LOC); `usage-examples/sparql-queries.md` folded into `advanced/ontology.md`; `references/benchmarks.md` folded into `references.md`.

## [0.4.2] - 2026-05-13

### Fixed

- `BookstoreGraph` (`docs/your-types-are-a-graph.html`) was missing the `BookListPage → Book` edge because the visualization's `refTarget()` only recognised `items.$ref` and not the inline `items.$id` pattern produced by `BaseTypes.page()`. Extended `refTarget()` to fall back to `items.$id` when `items.$ref` is absent.
- Sidebar anchor navigation was broken on 5 links: three `entities.*` method anchors in `advanced/ontology.html` (now use the actual `#jt-*` IDs), the Changeset link in `value/diff.html`, and the Quad / SubjectGroup link in `advanced/quads.html` (latter two had no matching heading; added).

## [0.4.1] - 2026-05-13

### Added

- Bookstore demo (β): new `examples/docs/bookstore/transforms.ts` (Transform.create + Transform.pipe pairwise compatibility), `examples/docs/bookstore/antiPatterns.ts` (Compose brand-error documentation via @ts-expect-error), and `scripts/bookstore-static.ts` (parametrised JsonTology static facade).
- Bookstore demo (α): five new entities (`StockLevel`, `PublicationDate`, `BookAnnotations`, `BookListPage`, `BookCatalogEntry`) and updates to `Book.authors` (uniqueItems), `EBook.fileFormat` (if/then/else), `Quantity` (int32 format brand) to demonstrate bounded multipleOf narrowing, the `date` format brand, patternProperties template-literal expansion, `BaseTypes.page()` factory, embedded-`$id` $ref resolution, `UniqueArrayBrandInterface`, generalised if/then/else inference, and a numeric format brand.
- Bookstore demo (γ): OWL 2 property-characteristic annotations on natural relations. `Review.customerId` (`functional`), `Customer.id` (`inverseFunctional`), `Order.placedAt` (`transitive` + `irreflexive`); new `SimilarBook` entity (`symmetric` + `reflexive`) and `Sequel` entity (`asymmetric`); `ValidateSchemaType<T>` opt-in compile-time self-checks on `OrderSchema` and `ReviewSchema`.

### Fixed

- 0.4.0 doc audit remediation: 11 critical + 17 high findings across `getting-started`, `schemas`, `constraint-brands`, `argument-conventions`, `composition/*`, `advanced/*`, `errors/*`, `migration-0.4.0`, `bookstore-domain`, and `validation-modes`. Fixes: wrong return type for `toQuads` (now correctly `QuadInterface[]`, not `OntologyBuilder`); `value.cast` (not `value.coerce`); brand interface names use the `...Interface` suffix throughout; `Lift.fromQuad` (not `fromRdfQuad`); `subschemaAt` documented as 2-arg; 5 previously-undocumented error codes added (`GRAPH_INVALID_RESTRICTION`, `SCHEMA_DUPLICATE_ID`, `SCHEMA_DUPLICATE_SHAPE`, `TRANSFORM_DECODE_FAILED`, `CYCLIC_DATA`); validation-mode badges corrected for `getDefaults` (Runtime), `complementOf` (split out from group badge), `sameAs` (badge added); bookstore folder layout aligned to actual entities. Two code changes: error-code constants (`SchemaErrorCode`, `GraphErrorCode`, etc.) now publicly exported from `'json-tology'`; `SchemaRefType` now publicly exported from `'json-tology/types'`, unblocking import patterns the docs claim work.

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
- `docs/schemas.md` TypeBox snippets in the "Define and Register a Schema", "Anonymous registration", and "Lookup by `$id` or symbol" sections. The earlier text routed TypeBox through AJV (`import Ajv from 'ajv'; ajv.validate(schema, …)`), which understated TypeBox by ignoring its own runtime. The corrected snippets use `@sinclair/typebox/value` (`import { Value } from '@sinclair/typebox/value'; Value.Check(schema, data)`) and note that `Type.Ref(target)` resolves against a user-maintained `$defs` map at compile time. No behaviour change, comparison-table accuracy only.

### Added

- Test-coverage closures: new suites for `Value` Bad paths, `viz/HtmlRenderer`, `viz/VizDataCollector`. Extended GBU coverage for `Hash` (cycles / BigInt / Symbol keys), `Transform` (encoder/decoder throws / pipe arity / empty pipe), and `Materializer` (cycles / depth / IRI collision / missing skolemizer).
- New `CliWriter` domain module (`src/modules/cli/CliWriter.ts`) owns all CLI stdout/stderr output. Replaces the inline `console.log`/`console.error` calls in `src/cli.ts` with explicit `writer.out()`/`writer.err()`/`writer.exit()` methods, removing the project's only `console.*` call sites and enabling test injection of CLI output.
- Compile-time tuple-distinctness narrowing for `uniqueItems: true`. `InferType<typeof Schema>` now folds `uniqueItems: true` into the inferred type two ways: (1) for homogeneous arrays, the inferred type carries `UniqueArrayBrandInterface<T>` (a generic uniqueness brand parameterised by element type, in `src/types/ConstraintBrands.ts`) so a plain `T[]` cannot satisfy it. Values must come through `JsonTology.instantiate` / `coerce` / `materialize`; (2) for literal-typed tuples (≤ 8 elements, declared via `prefixItems`), `UniqueTuplePairwiseType` runs a pairwise overlap check at the type level and collapses the tuple to `never` when any pair of element types overlaps, so `{ prefixItems: [{const:'red'},{const:'red'}], uniqueItems: true }` is a compile-time error. Above the 8-element cap the tuple passes through unchanged and runtime validation still enforces `uniqueItems`. Closes Finding 25 of `designs/0002-total-compile-time-enforcement.md`.
- 25 named format-brand aliases in `src/types/ConstraintBrands.ts` covering the full JSON Schema 2020-12 standard format set plus json-tology built-ins: `EmailBrandInterface`, `IdnEmailBrandInterface`, `UriBrandInterface`, `UriReferenceBrandInterface`, `UriTemplateBrandInterface`, `IriBrandInterface`, `IriReferenceBrandInterface`, `UuidBrandInterface`, `DateBrandInterface`, `DateTimeBrandInterface`, `TimeBrandInterface`, `DurationBrandInterface`, `HostnameBrandInterface`, `IdnHostnameBrandInterface`, `Ipv4BrandInterface`, `Ipv6BrandInterface`, `RegexBrandInterface`, `JsonPointerBrandInterface`, `RelativeJsonPointerBrandInterface`, `BinaryBrandInterface`, `ByteBrandInterface`, `Int32BrandInterface`, `Int64BrandInterface`, `FloatBrandInterface`, `DoubleBrandInterface`. Each alias specialises `FormatBrandInterface<F>` to a single format string so a consumer can write `function send(to: EmailBrandInterface): void` and reject plain `string` arguments at compile time. The brand-first intersection ordering (`FormatBrandInterface<F> & string`) keeps the named brand visible in IDE hovers instead of being hidden behind `string`. Closes Finding 23 of `designs/0002-total-compile-time-enforcement.md`.
- Compile-time test coverage for `multipleOf` bounded-range literal-union narrowing (`test/types/multiple-of-bounded.test.ts`). The narrowing itself (`MultipleOfRangeType<TMin, TMax, TStep>` in `src/types/Infer.ts`) was already wired into the integer-typed branch of `InferType`: when `type: 'integer'` is combined with literal `minimum`, `maximum`, and `multipleOf` and `(max - min) / multipleOf ≤ 50` (the `IntegerRangeCap`), the inferred type is the literal union of in-range multiples (e.g. `{type:'integer',min:0,max:10,multipleOf:2}` → `0|2|4|6|8|10`). Above the cap the type falls through to `number`; bounded integer ranges without `multipleOf` continue to use the existing `IntegerRangeType` path; offset minima emit only multiples within the bounds (e.g. `min:7,max:20,multipleOf:5` → `10|15|20`). Closes Finding 24 of `designs/0002-total-compile-time-enforcement.md`.
- Canonical JSON Schema dialect declaration on every user-facing docs page. `docs/getting-started.md`, `docs/index.md`, `docs/references.md`, and `docs/schemas.md` now state explicitly that json-tology targets **JSON Schema draft 2020-12** (`https://json-schema.org/draft/2020-12/schema`). `docs/references.md` gains a new "Supported dialect" section as the canonical home for the statement; other pages link or echo it. This removes ambiguity for users coming from older drafts and surfaces the IETF JSON Schema Working Group standardization track on the schema page.
- **Full OWL 2 property-characteristic vocabulary.** Five new schema keywords (`asymmetric`, `functional`, `inverseFunctional`, `irreflexive`, `reflexive`) join the existing `symmetric` / `transitive` keywords and round out the OWL 2 property characteristics. Setting a keyword to `true` on a property schema emits the corresponding `rdf:type owl:*Property` quad through the canonical graph and the OWL TBox projection (`GraphOntologySerializer`). The constants `OWL.AsymmetricProperty`, `OWL.FunctionalProperty`, `OWL.InverseFunctionalProperty`, `OWL.IrreflexiveProperty`, `OWL.ReflexiveProperty` (in `src/constants/IRI.ts`) and `RDFS.subPropertyOf` are exposed alongside the keywords; `OWL_CORE_PREDICATES` in `src/constants/ONTOLOGY_PREDICATES.ts` now lists the full set. `SchemaGraphSemanticsInterface` carries each characteristic as a boolean field so consumers can inspect them on the canonical graph without re-reading the source schema. `RelationPredicateType` (`src/types/SchemaGraph.ts`) widens to cover the five new property types.
- Docs: external-references integration. New "Tooling and ecosystem" section in `docs/references.md` covering [sourcemeta/jsonschema](https://github.com/sourcemeta/jsonschema) (peer JSON Schema CLI), the Sourcemeta essay [AI only speaks JSON Schema](https://www.sourcemeta.com/blog/ai-only-speaks-json-schema/) (LLM convergence on JSON Schema as the lingua franca for structured outputs and tool calling), and the [IETF JSON Schema Working Group](https://datatracker.ietf.org/wg/jsonschema/about/) (Proposed Standard track). Inline links from `docs/index.md` (LLM consumer angle in the cross-language interop section), `docs/getting-started.md` (sourcemeta/jsonschema as peer ecosystem tooling), and `docs/schemas.md` (IETF WG as the standardization track for draft-2020-12).
- `ValidateSchemaType<T>` (in `src/types/SchemaValidation.ts`) and structured error brands `RequiredKeyNotInPropertiesInterface`, `DependentRequiredKeyNotInPropertiesInterface`, `IfDiscriminatorNotInPropertiesInterface` (in `src/types/TypeErrors.ts`): compile-time cross-keyword schema validator for Cluster B of `designs/0002-total-compile-time-enforcement.md` (Findings 7, 8, 9). Catches `required` entries that are not keys of `properties`, `dependentRequired` map keys or value-array entries that are not keys of `properties`, and `if.properties` discriminator keys that are not keys of the parent `properties`. Applied as a parameter constraint inside `Compose.subClassOf`, `Compose.complementOf`, `Compose.disjointWith`, and `Compose.extend` so Compose-built schemas are correct by construction. Hand-written schemas can opt in via `const _ok: ValidateSchemaType<typeof MySchema> = MySchema;`.
- Compile-time argument validation for `Compose.*` builders (Cluster A of `designs/0002-total-compile-time-enforcement.md`):
  - `Compose.pick(schema, keys, newId)`: `keys` are now bound to `keyof properties`; passing a non-existent key is a type error rather than a silent empty-properties result.
  - `Compose.omit(schema, keys, newId)`: same `keyof properties` constraint as `pick`.
  - `Compose.subClassOf(parent, body)`: body's `$id` cannot match the parent's `$id` (or any element's `$id` when the parent is a tuple of schemas). Self-subclass surfaces a `SelfSubClassType` brand error.
  - `Compose.discriminatedUnion(prop, variants, newId)`: every variant must declare `properties[prop]` as `const` and list `prop` in `required`. Missing or non-const discriminators surface a `DiscriminatorMissingType` brand error.
  - `Compose.equivalent(source, options)`: `options.$id` cannot equal `source.$id`; self-equivalent surfaces a `SelfEquivalentType` brand error.
  - `Compose.intersection(schemas, newId)`: `newId` cannot collide with any input schema's `$id`; collision surfaces an `IntersectionIdCollisionType` brand error.
  - The named brand error types live in `src/types/TypeErrors.ts` (alongside Cluster B's validator-result interfaces) so IDE hovers describe the failure rather than reporting a generic "not assignable to never".
- `Compose.someValuesFrom` / `Compose.allValuesFrom` / `Compose.hasValue` / `Compose.cardinality` / `Compose.minCardinality` / `Compose.maxCardinality`: opaque restriction descriptors that compose with `Compose.subClassOf(restriction, body)` to attach OWL property restrictions to a class. The TBox projection emits anonymous `owl:Restriction` blank nodes (`_:b{n} rdf:type owl:Restriction; owl:onProperty <prop>; owl:<predicate> <value>`) linked via `rdfs:subClassOf`. New `Compose.subClassOf` overload accepts a `RestrictionRefType` parent and stores descriptors under the body's `jt:restrictions` annotation.
- `JsonTology.sameAs`: declare ABox identity between two named individuals. `SameAsStore` accumulates the assertions; the OWL ABox projection emits `owl:sameAs` triples in both directions.
- Doc pages: `docs/composition/restrictions.md` (OWL restrictions reference) and `docs/advanced/sameas.md` (sameAs identity reference).
- Bookstore demo extended with seven new entities to exercise every `Compose` class-axiom and OWL restriction: `EBookSchema` (subClassOf), `PrintBookSchema` (subClassOf + disjointWith EBook), `RareBookSchema` (subClassOf PrintBook + someValuesFrom + maxCardinality), `SoloAuthoredBookSchema` (subClassOf Book + cardinality), `AnthologyBookSchema` (subClassOf Book + minCardinality + allValuesFrom), `InPrintBookSchema` (subClassOf Book + hasValue), and `OutOfPrintBookSchema` (complementOf InPrintBook, body `allOf` bounded to Book so the OWL complement is restricted to the Book universe rather than spanning ⊤). The `bookstoreEntities` registry also records an `owl:sameAs` between two customer IRIs.
- `BookstoreGraph` Vue component now reads user-authored restrictions directly from each schema's `jt:restrictions` annotation (one edge per descriptor) instead of walking inlined `owl:Restriction` blank nodes from the OWL projection. That path was emitting auto-derived `minCardinality 1` for every `required` field and `allValuesFrom` for every `items.$ref`, both of which were structural noise. The new path renders six clean edges, one per user-authored restriction, with labels `prop ∃` / `prop ∀` / `prop = literal` / `prop card =N` / `prop card ≥N` / `prop card ≤N`.
- `BookstoreGraph` also gains a navigation pane (zoom in / zoom out / fit-to-view / re-run-layout) docked bottom-right of the container, plus relaxed zoom limits so the user can back out for an overview as well as zoom in to read labels.
- Brand wordmark gradient reshaped to dark → mid → dark (was light → mid → dark) for stronger contrast against both light and dark page backgrounds while staying within the teal family.
- `bookstore-domain.md` rewritten to show the full generating code (one `entities/*.ts` listing per axiom kind) plus a graph-edge legend table. Every declaration that produces an edge in the live `BookstoreGraph` is reproduced verbatim, so the docs page is the single reference for what the graph depicts.
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
  - The `pipe` parameter is typed `TStages & ValidatePipeChainType<TStages, InferSchemaType<TSchema>>`. When validation fires, the intersection collapses incompatible positions to `never`, and the user's literal stages are not assignable. The call site is rejected with the offending stage type pointed out by the compiler. New positive + negative type-level tests cover (a) well-typed chains of length 1 to 4, (b) two-stage pairwise mismatches, (c) three-stage middle-of-chain mismatches, (d) wire-type-vs-first-stage mismatches.
  - Audit of `Transform.encode` (Finding 11): the existing signature on `JsonTology.encode(schema, value)` already constrains `value` to the schema's decoded type via `TransformedType<TSchema, TOut>`. New positive + negative tests pin the contract. Passing a wire-form string or an unrelated type to `jt.encode(transformedDateSchema, ...)` fails compilation.
- **Compile-time tuple narrowing for raw `minItems` / `maxItems`** (designs/0002 Cluster C / Finding 17). `InferType` on an array schema now folds raw JSON Schema bounds into the inferred shape, mirroring the OWL `cardinality` / `minCardinality` / `maxCardinality` narrowing path:
  - `minItems === maxItems === N` → `BuildExactTupleType<T, N>` (length exactly `N`).
  - `minItems > 0` with no `maxItems` → `BuildAtLeastTupleType<T, minItems>` (`[T, ..., T, ...T[]]`).
  - `maxItems` with no `minItems` → `BuildAtMostTupleType<T, maxItems>` (union of tuples length `0..maxItems`).
  - `minItems < maxItems` → `BuildBoundedTupleType<T, minItems, maxItems>` (union of tuples length `minItems..maxItems`).
  - Bounds without `items` narrow the tuple shape over an `unknown` element. Cap at `TupleCapType = 16`; bounds at or beyond the cap fall through to `readonly T[]` to keep recursion within TS limits. Existing `BuildFixedTupleType` / `BuildMinTupleType` helpers (length cap 10) in `Infer.ts` are removed in favour of the unified `RestrictionInfer.ts` builders so the OWL and raw paths share one implementation. New `test/types/infer-array-bounds.test.ts` covers exact / min-only / max-only / bounded-range / beyond-cap / no-bounds / raw-without-items cases.
- **Compile-time enforcement for the registry and cross-schema references** (designs/0002 Cluster E / Findings 12-16):
  - **Finding 12:** `JsonTology.create({ schemas: [A, B, ...] })` now brands offending tuple slots with `DuplicateSchemaIdInterface<TId>` (in `src/types/TypeErrors.ts`) when two schemas share an `$id`, so the duplicate IRI is named in editor diagnostics and the call fails to compile.
  - **Finding 13:** `JsonTology.addComputed` and `JsonTology.addInvariant` now take `schemaId: keyof TMap & string`, rejecting unregistered IRIs at compile time. Existing `addInvariant<T>(schemaId, invariant)` call sites continue to work because the data-type generic is preserved.
  - **Finding 14:** `JsonTology.findDuplicates()` (a new typed facade over `registry.findDuplicates()`) returns `readonly DuplicateReportEntryType<keyof TMap & string>[]`. The underlying `DuplicateReportEntryType` interface gained an optional `TEquivalentTo extends string = string` parameter so the literal-IRI variant is opt-in and the existing untyped call site is unchanged.
  - **Finding 15:** `InferType<S, TReferences>` now resolves an absolute `$ref` whose IRI is missing from a non-empty `TReferences` map to `RefNotFoundInterface<TRef>` (in `src/types/TypeErrors.ts`) instead of silent `unknown`. With no references map in scope (`Record<never, never>`) the historical `unknown` fallback is preserved, so non-registry consumers are unaffected.
  - **Finding 16:** Cross-schema fragment refs (`<base>#<anchor>`) emit `RefNotFoundInterface<base>` when the base IRI is absent and `AnchorNotFoundInterface<base, anchor>` when the base resolves but the anchor / `$defs` / pointer fragment doesn't. Local `#anchor` refs against the root schema are unchanged.
  - New `test/types/cross-schema-resolution.test.ts` covers Findings 15 / 16 (positive resolution, missing base, missing anchor, missing pointer, no-references-map fallback). `test/types/registry-inference.test.ts` extended with Findings 12 / 13 / 14 positive + `@ts-expect-error` negative cases.

### Changed

- Bumped TypeScript to 6.0 (was 5.9). Required adding explicit `types: ["node"]` to `tsconfig.json` so node built-in modules resolve under the new default. Code paths that previously relied on `as unknown as Foo` casts in places where TS5 still required a hint now use direct assignment. The casts were dead weight under TS6's improved inference.
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

- Docs: full polish pass across all 50+ pages. Em-dashes and en-dashes replaced with direct prose equivalents. Filler words replaced with factual prose. Comparator code-group blocks updated to show workaround attempts with explicit Limitation notes where a library cannot fully support the concept. Related and See also sections added to every operator page. Homepage switched from layout: home to layout: doc with HomeFeaturesHero component, making the sidebar visible on the landing page.

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

- Docs: full polish pass across all 50+ pages. Em-dashes and en-dashes replaced with direct prose equivalents. Filler words replaced with factual prose. Comparator code-group blocks updated to show workaround attempts with explicit Limitation notes where a library cannot fully support the concept. Related and See also sections added to every operator page. Homepage switched from layout: home to layout: doc with HomeFeaturesHero component, making the sidebar visible on the landing page.

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
[0.23.1]: https://github.com/Studnicky/json-tology/compare/v0.23.0...v0.23.1
[0.23.0]: https://github.com/Studnicky/json-tology/compare/v0.22.0...v0.23.0
[0.4.0]: https://github.com/Studnicky/json-tology/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/Studnicky/json-tology/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Studnicky/json-tology/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Studnicky/json-tology/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Studnicky/json-tology/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Studnicky/json-tology/compare/v0.1.0...v0.2.0
