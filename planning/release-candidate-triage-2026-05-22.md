# Release Candidate Triage — 2026-05-22

Cross-cutting audit covering architecture, data modeling, patterns, performance, stability, and public API surface. Source: six parallel specialist agents (architecture, semantic-architect, typescript, optimizer, test-engineer, archivist) run against the v0.14.0 codebase.

Each finding carries a severity, an evidence pointer (file:line), the issue, the impact, and a fix direction. Items are grouped by severity, then by area. The recommended sequence at the bottom batches related work to minimize churn.

## Executive summary

The architectural contract is substantially upheld: the canonical graph is the single source of truth for the core paths (validation, ABox projection, OWL/SHACL serialization). The error hierarchy is clean, constants are centralized, and the documented core classes implement named interfaces.

The recurring failure mode sits at the seams. Three distinct manifestations of the same root cause: **the graph stores compact CURIEs internally, and expansion to full IRIs is a per-call-site convention rather than an invariant**. Until that's reversed, every new emit path is a potential leak.

Secondary themes:
- The `src/types/` ↔ `src/interfaces/` split is eroding (40+ interfaces misplaced). <- correct it
- The public API has two outright contract breaches (`validate` drops `callOptions`, README disagrees with `package.json` on `jsonld`). <- correct it
- Error codes are exported as public surface faster than they are thrown. <- correct it
- A global blank-node counter creates a latent concurrency hazard with zero test coverage. <- we have canonicalizer in semantics (workspace) that does this, as well as IRI utils, _port_ them as self-contained modules (and any others that would make sense :: explore that workspace for what are good utils to consume here, PORT them)

---

# Tier 1 — CRITICAL — fix before next release

## C-1. CURIE-at-rest: XSD datatype values stored as compact strings in the graph

**Evidence.** `src/modules/rdf/XsdTypes.ts:27-29,44-62`; `src/constants/XSD_MAPS.ts:54-59`; `src/modules/rdf/Projection.ts:479-484`; `src/modules/graph/SchemaGraphRelations.ts:672-680`; `src/modules/rdf/ShaclProjection.ts:459`; `src/modules/rdf/QuadFactory.ts:192`.

**Issue.** `XsdTypes.resolveSingle` returns compact CURIE strings (`'xsd:string'`, `'xsd:dateTime'`, `'xsd:integer'`). These are stored as relation targets in the graph. Expansion to full IRIs happens only at `QuadFactory.{quad,iri,literal}` call sites when a `curie` option is passed. `JsonTology.toQuads` now passes it (the recent fix). Direct callers of `Projection.abox` / `ShaclProjection.graph` / `OwlProjection.graph` without `{ curie }` get spec-violating compact strings in `term.value`.

**Impact.** RDF/JS spec violation reachable from non-facade entry points. Future consumers writing vocabulary plugins or alternative projection paths will reproduce the leak.

**Fix direction.** Make `XsdTypes` and the IRI constants (`RDF`, `OWL`, `RDFS`, `SH`, `XSD`, `DCT`, `JT`, `DASH`) store full IRIs at rest. `expandCurieIfNeeded` becomes a no-op for these. The curie option survives only as a display concern. Removes dual-form recognition guards in `Lists.ts` and `JsonLdFormatter.ts` as dead code. <- don't we have curie utils we can port from semantics to help fix this?

## C-2. `validate()` overload silently drops `callOptions`

**Evidence.** `src/JsonTology.ts:1330-1331` (public overloads), `src/JsonTology.ts:1332-1344` (implementation), `src/interfaces/SchemaRegistry.ts:83`.

**Issue.** Both public overloads declare `callOptions?: { enableDefaults?: boolean }`. The implementation signature omits the parameter and the body never reads it. `SchemaRegistryInterface.validate` doesn't accept it either. Consumers reading the TSDoc will write code that compiles, runs, and silently has no effect.

**Impact.** Promise-breaking public contract. Any consumer trying to replicate `instantiate()`-style default injection in a non-throwing context will be confused.

**Fix direction.** Either thread the parameter through `SchemaRegistryInterface.validate` end-to-end (parity with `instantiate`), or remove the parameter from both public overloads and the TSDoc.

<- must be fixed the proper longterm architecture way

## C-3. `LoadError` and six `LOAD_*` error codes are exported public API but never thrown

**Evidence.** `src/errors/LoadError.ts`; `src/constants/ERROR_CODES.ts` (all six `LOAD_*` codes); `src/index.ts:11-18` (`LoadErrorCode` exported). Zero `new LoadError(...)` call sites in `src/modules/`.

**Issue.** The class and all six codes are dead public surface. Consumers can't catch what is never thrown.

**Fix direction.** Remove from public exports until a file-loader path emits the class. A test that cannot be written to trigger the class is a design gap, not a test gap.

<- this sounds like tech debt to be cleaned up

## C-4. Cross-schema `$ref` round-trip via `toQuads`/`fromQuads` is explicitly untested

**Evidence.** `test/e2e/ontologyRoundTrip.test.ts:728` (explicit skip comment).

**Issue.** The e2e suite skips the multi-graph ABox projection case (e.g., `Employee.address: Address` where `Address` is a separately registered schema). This is the most common production topology and the failure mode (wrong named graph, lost nested object on lift) is silent.

**Fix direction.** Add an integration test that projects a schema with cross-schema `$ref` and asserts the nested object reconstructs through `fromQuads`.

<- yes

---

# Tier 2 — HIGH — material correctness, performance, or contract issues

## H-1. `jt:restrictions` bypasses the canonical graph <- unacceptable

**Evidence.** `src/modules/rdf/OwlProjection.ts:430-476` (`emitUserRestrictions`). Cross-confirmed by architecture and data-modeling audits.

**Issue.** Reads `graph.rootSchema['jt:restrictions']` directly. Data is not represented in `SchemaGraphRelations.extractRelations` and is invisible to `graph.allRelations()`. `fromTbox` round-trip cannot reconstruct it.

**Fix.** Add `restrictions` to `SchemaGraphSemanticsInterface`; emit restriction relations during extraction; collapse `emitUserRestrictions` to a thin relation iterator.

## H-2. `format` annotation on primitive schemas reads raw `source.schema.format`

**Evidence.** `src/modules/rdf/OwlProjection.ts:365-375` (`emitDatatypeQuads`). Cross-confirmed by architecture and data-modeling audits.

**Issue.** Reads `entry.all[0].source.schema.format` instead of a graph relation. `DCT.format` relation already exists for non-primitive nodes — extend coverage to primitives in `SchemaGraphRelations.extractRelations`. <- correct this <- unacceptable, fix it

## H-3. `Lift.fromExternalRdfJsQuad` normalizes the wrong direction (full IRI → compact)

**Evidence.** `src/modules/rdf/Lift.ts:441-468`, `src/modules/rdf/Lift.ts:64`, `src/modules/rdf/Lift.ts:482-488` (deprecated notice); `src/constants/PREFIXES.ts:20`.

**Issue.** Marked `@deprecated` but still operational. Converts full-IRI `rdf:type` predicates to the compact string `'rdf:type'` and XSD full IRIs to `'xsd:localName'`. Mixing quads from `toQuads` (full IRIs) with quads from `Lift.fromExternalQuad` makes `quad.predicate.equals()` return false for structurally identical triples.

**Fix.** Correct `normalizeDatatype` to emit full IRIs; remove `fromExternalRdfJsQuad` in the next major. <- all of this tech debt must be addressed _now_

## H-4. `quad.graph` is mutated in-place after construction when `graphIRI` is set

**Evidence.** `src/modules/rdf/Projection.ts:360-366`. Cross-confirmed by data-modeling and performance audits.

**Issue.** All quads are built with `defaultGraph()`, then iterated and reassigned `quad.graph` in a second pass. Breaks value-object discipline, demotes V8 hidden classes on the `graph` slot, and creates a window where a streaming consumer can observe quads pre-stamp.

**Fix.** Thread `graphIRI` to the quad construction site; set the correct graph term in `Terms.quad`/`QuadFactory.quad` from the start. <- unacceptable, fix it

## H-5. `anyOf` and `oneOf` both map to `owl:equivalentClass`

**Evidence.** `src/modules/graph/SchemaGraphRelations.ts:535-543` (`pushCompositionRelations`).

**Issue.** OWL reasoners cannot infer disjointness from `oneOf`. Round-trip through `fromTbox` may produce `anyOf` for schemas originally written as `oneOf`.

**Fix.** Add a distinct predicate (`OWL.disjointUnionOf` or `jt:oneOf`) for `oneOf` branches. <- use only proper OWL

## H-6. README installs `jsonld` as a peer dep; `package.json` ships it as a runtime dep

**Evidence.** `README.md:30`; `package.json:150` (`dependencies.jsonld: "^9.0.0"`, no `peerDependencies`); `CHANGELOG.md` v0.14.0 entry.

**Issue.** README says `npm install json-tology jsonld`. `jsonld` is bundled. New consumers install two copies; version mismatches inevitable.

**Fix.** Remove the peer install instruction from README. <- unacceptable, fix it, should not be a runtime requirement (why is it?)

## H-7. Global blank-node counter is process-mutable with no concurrency test

**Evidence.** `src/modules/rdf/QuadFactory.ts:47` (module-level `let bnodeCounter = 0`); `src/modules/rdf/Projection.ts:326` (per-call reset); zero test coverage.

**Issue.** Two overlapping `await Promise.all([toQuads(...), toQuads(...)])` calls can corrupt each other's counters, producing colliding blank node IRIs across result sets. In any server environment processing concurrent requests, this is silent data corruption.

**Fix.** Replace with a per-call counter (preferred — passed via projection context) or add an explicit concurrency test that fails today, then fix. <- Port from SEMANTICS project

## H-8. Untested error code contracts

**Evidence.**
- `POINTER_NOT_SCHEMA` — `src/modules/graph/SchemaGraphSupport.ts:456`, 0 test matches.
- `ANCHOR_NOT_FOUND` — `src/modules/graph/SchemaGraph.ts:497`, `src/modules/graph/QuadBackedSchemaGraph.ts:655`, 0 test matches.
- `SCHEMA_VALIDATOR_MISSING` — `src/modules/registry/SchemaRegistry.ts:550`, 0 test matches.
- `BOOLEAN_SCHEMA_FRAGMENT` — `src/constants/ERROR_CODES.ts:28`, `src/types/ErrorCodes.ts:19`, **never thrown anywhere**.
- `OwlImportErrorCode` (all 5 values) — `src/modules/ontology/OwlImporter.ts:552` is the only throw site (code `OWL_IMPORT_NOT_IMPLEMENTED`); requires mocking `tryLoadJsonLd` to reach.
- Several existing tests (`DIALECT_UNSUPPORTED`, `VOCABULARY_UNSUPPORTED`, `COMPUTED_INPUT_FORBIDDEN`) assert on message regex, not `err.code`.

**Fix.** Add `.code` assertions to existing throws-tests. Remove `BOOLEAN_SCHEMA_FRAGMENT` and the unreachable `OwlImportErrorCode` values, or wire up their throw sites. <- fix them yes

## H-9. Per-call allocations in `GraphEngine.execute()`

**Evidence.** `src/modules/graph/GraphEngine.ts:238-244`.

**Issue.** `new Set()` and `[]` allocated unconditionally per call for `refStack`, `dynamicScope`, `evaluatedItems`, `evaluatedProperties`. Most simple schemas never populate the latter two. At 10k validates/sec, ~40k short-lived objects/sec pressure the GC.

**Fix.** Hoist empty `refStack` singleton; resolve evaluated-set state at the boundary only when read by the caller. <- yes

## H-10. `Curie.compact()` has no cache; full prefix scan per call

**Evidence.** `src/modules/rdf/Curie.ts:28-47`.

**Issue.** `Curie.expand()` memoizes via `expandCache`. `compact()` iterates `Object.entries(this.prefixes)` every call. Used indirectly per IRI in TBox/SHACL serialization. Prefix map is immutable post-construction; cache is always valid.

**Fix.** Add a `compactCache: Map<string, string>` mirror of `expandCache`. <- why can't they share a cache?

## H-11. `QuadFactory.{quad,iri,literal}` allocates `{ curie }` literals at every call site

**Evidence.** `src/modules/rdf/Projection.ts` (41+ call sites); `src/modules/rdf/QuadFactory.ts:184,191,207`.

**Issue.** Every call passes `{ curie }` as a fresh object literal for the `options` parameter, immediately destructured inside. 30–100 throwaway objects per `toQuads` call for a moderate schema.

**Fix.** Pass `curie` as a direct optional parameter, not options-wrapped. <- Y

## H-12. `validateObject()` rebuilds `patternPropertyEntries` per call

**Evidence.** `src/modules/graph/GraphEngine.ts:575-583`.

**Issue.** `sem.patternPropertyEntries.map(...)` builds an array of `{ pattern, regex, node }` per object validation. Regex is cached, the array isn't. Schemas with pattern properties pay N allocations per validated object.

**Fix.** Cache the mapped array on graph semantics or via WeakMap keyed by node identity. Schema is frozen post-registration; cache is always valid. <- y fix it

## H-13. `interface` declarations misplaced in `src/types/`

**Evidence.** `src/types/AboxOptions.ts:4`, `src/types/Schema.ts:130`, `src/types/Validation.ts:10,18,24`, `src/types/NormalizedToQuadsOptions.ts:3`, `src/types/TypeConfig.ts:19`, `src/types/Restriction.ts:24`, `src/types/RawRestrictionDescriptor.ts:1`, `src/types/Diff.ts:5,11`, `src/types/Brand.ts:5`, `src/types/ConstraintBrands.ts:34-44`, `src/types/TypeErrors.ts:41,52,63,80,92,105,124,142,206`, `src/types/RestrictionInfer.ts:50,55`.

**Issue.** 40+ `export interface` declarations live in `src/types/` alongside type aliases. Several carry the `Interface` suffix while in `src/types/`. The directory naming convention loses its meaning as a navigation aid.

**Fix.** Migrate standalone `interface` declarations to `src/interfaces/`. Keep type aliases (especially the complex generic aliases in `TypeErrors.ts` and `RestrictionInfer.ts` that serve as compile-time error shapes) in `src/types/`. Split mixed files. <- interfaces are for classes only, types are the primitives (json-schema defined entites, ajv and json-schema-to-ts) only use interfaces for expressing class constructs with callabled as _supersets_ that _expand upon types_ (types express the properties and data of classes,interfaces extend them with their methods)

## H-14. `ToQuadsOptionsType` declared inline in facade; `DuplicateReportEntryType` barrel-imported

**Evidence.** `src/JsonTology.ts:94-97` (`ToQuadsOptionsType` inline), `src/JsonTology.ts:65` (`DuplicateReportEntryType` imported from `./modules/registry/SchemaRegistry.js` rather than its defining file `./interfaces/SchemaEntryStore.js`).

**Issue.** `ToQuadsOptionsType` is part of the public API but lives in the facade file. `DuplicateReportEntryType` import goes through a module re-export — the internal-barrel pattern the rules prohibit.

**Fix.** Move `ToQuadsOptionsType` to `src/interfaces/` (it's an interface despite the `Type` suffix; rename to `ToQuadsOptionsInterface`). Change the `DuplicateReportEntryType` import to its defining file. <- Y fix it>

## H-15. Public interfaces unexported from `json-tology/interfaces`

**Evidence.** `src/interfaces/index.ts` — missing: `TransformStage` (`TransformStageInterface`, `AnyTransformStageInterface`), `Projection` (`IriMinterInterface`, `ProjectInstanceArgs`, `ProjectPropertyArgs`).

**Issue.** Vocabulary-plugin authors and consumers writing typed transform chains must reach into internal paths to annotate variables.

**Fix.** Add `TransformStage` and `Projection` to `src/interfaces/index.ts`. Confirm remaining unlisted files (`BuildOptions`, `RefResolutionLoader`, `SchemaRefWalker`, `SimplePredicateEntry`, `VizOptions`) are intentionally internal; add a comment to that effect. <- only public callables should be here but yes

---

# Tier 3 — MEDIUM — quality, polish, hardening <- yes fix all these>

## Architecture / data modeling

**M-A-1.** `SchemaCompiler.compile` falls back to constructing its own `SchemaGraph` if none is passed.
Evidence: `src/modules/validation/SchemaCompiler.ts:1374`.
Fix: Make the graph parameter required at the type level. <- Y

**M-A-2.** `OwlImporter` dispatchers traverse raw `QuadInterface[]` rather than the `QuadBackedSchemaGraph` they receive.
Evidence: `src/modules/ontology/OwlImporter.ts:495`; dispatchers in `importDispatch/`.
Fix: Migrate dispatchers to traverse `ctx.graph.allRelations()` and use `ctx.graph.semantics(node)` for attribute access. <- Y

**M-A-3.** `XsdTypes.resolve` returns `'owl:Nothing'` for null-type schemas, which surfaces as a SHACL `sh:datatype` of `owl:Nothing` — not a valid datatype IRI.
Evidence: `src/modules/rdf/XsdTypes.ts:27-29`; `src/modules/graph/SchemaGraphRelations.ts:672-680`.
Fix: When `XsdTypes.resolve` returns `owl:Nothing`, omit `sh:datatype` and emit a `sh:in [rdf:nil]` instead, or skip the property shape entirely.

**M-A-4.** `SH.PROPERTY_IRI` is a full IRI alone among compact CURIEs in `IRI.ts` — encoding inconsistency.
Evidence: `src/constants/IRI.ts:81`; `src/constants/SHACL.ts:3`.
Fix: Once Tier 1 #C-1 is done (full IRIs at rest everywhere), this falls out naturally.

## Public API

**M-P-1.** `toShacl` has no inverse (`fromShacl` / SHACL-driven validation entry).
Evidence: `src/JsonTology.ts:1293,1335`.
Fix: Either implement `validateWithShacl(shapes, data)` or document the asymmetry explicitly in the `toShacl` TSDoc. <- must have symmetry, explore the apacen/leftovers for concepts

**M-P-2.** `public readonly materializer` on `JsonTology` is undocumented; bypasses `appendSameAsQuads` if called directly. <- should not bypass, how can we make this proper?
Evidence: `src/JsonTology.ts:587`.
Fix: Add a TSDoc block with a caution mirroring the `registry` field's documentation.

**M-P-3.** `SchemaRegistryInterface` types `computedStore: ComputedStore` and `sameAsStore: SameAsStore` against concrete classes, leaking implementation shapes.
Evidence: `src/interfaces/SchemaRegistry.ts:7-9`.
Fix: Extract `ComputedStoreInterface` and `SameAsStoreInterface`; reference those. <- Y

**M-P-4.** No `@experimental` / `@deprecated` tags on `owl-gen` codegen or `VocabularyPluginInterface`.
Evidence: full source scan.
Fix: Apply `@experimental` to fast-moving surfaces; this is pre-1.0 — consumers cannot infer stability without it. <- Sure but no deprecations

**M-P-5.** `Lift.fromExternalQuad` `@deprecated` notice doesn't point at the replacement (`Lists.narrowExternalQuads` + `Lift.instances`).
Evidence: `src/modules/rdf/Lift.ts:482-488`.
Fix: Update the notice to reference `Lists.narrowExternalQuads`. <- y canonicalize

**M-P-6.** TSDoc `@throws` lines don't reference the relevant `*ErrorCode` discriminants.
Evidence: facade method TSDoc blocks in `src/JsonTology.ts`.
Fix: Add `@throws {InstantiationError} code INSTANTIATION_FAILED when...` style lines. <- fix it

## Patterns

**M-X-1.** Duplicate type shapes — `SubjectIndex` defined twice; `ExternalRdfJsQuad` / `ExternalRdfJsQuadShape` are character-identical with different names.
Evidence: `src/modules/graph/QuadBackedSchemaGraph.ts:120`; `src/modules/ontology/importDispatch/Datatypes.ts:523`; `src/modules/ontology/importDispatch/ClassExpressions.ts:67` (named `SubjectQuadIndex`); `src/modules/ontology/OwlImporter.ts:281`; `src/modules/rdf/Lift.ts:432`.
Fix: Consolidate to a single named type in `src/interfaces/` or the natural owner module. <- y fix it

**M-X-2.** `JsonLdDatasetQuad` exported from `QuadFactory.ts` (module file) but consumed by `OntologyBuilder.ts`.
Evidence: `src/modules/rdf/QuadFactory.ts:36`.
Fix: Move to `src/interfaces/`. <- y fix it

**M-X-3.** `OntologyBuilder` (10 public methods, public export) has no `implements` clause and no `OntologyBuilderInterface`.
Evidence: `src/modules/ontology/OntologyBuilder.ts:30`; `src/interfaces/Ontology.ts` (options interface only).
Fix: Define `OntologyBuilderInterface`; add `implements` clause. <- y fix it

**M-X-4.** Static-only utility classes should be plain modules. <- no they should be fucking static utility classes shut the fuck up
Evidence: `SchemaIri`, `Frozen`, `Resolver`, `Path`, and the `exec/` cluster (`Arrays`, `Objects`, `Scalars`, `Composition`).
Fix: Convert to named function exports. The exec/ cluster can stay (internal, matches the documented `Compose`/`Transform` exception).

## Performance

**M-F-1.** `Hash.value` allocates fresh `keySortReplacer` sorted-objects per object node per hash.
Evidence: `src/modules/hash/Hash.ts:17-28`; `src/modules/rdf/Projection.ts:371-374`.
Fix: Pre-sort schema-defined property order at graph-build time; use that order directly in the replacer instead of dynamic key sorting. <- y fix it

**M-F-2.** `SchemaRegistry.instantiate` spreads `this.instantiateOptions` (frozen) on every call even when no override is present.
Evidence: `src/modules/registry/SchemaRegistry.ts:697-702`.
Fix: Pass directly to `compiled.validate()` when `callOptions` is `undefined`. <- y fix it

**M-F-3.** `listGraphs()` / `list()` spread `Map.values()` into intermediate arrays per call.
Evidence: `src/modules/registry/SchemaRegistry.ts:813-823`.
Fix: Use `Array.from(this.store.values(), ...)` to fuse the map step. <- y fix it

**M-F-4.** `findDuplicates()` is called after every `registerSingle()` — O(N²) registration cost.
Evidence: `src/modules/registry/SchemaRegistry.ts:929-944`; `src/modules/registry/SchemaEntryStore.ts:59-87`.
Fix: Defer to lazy / explicit opt-in. <- maybe? We want this working

**M-F-5.** `Materializer.collectEffectiveProperties` allocates `Map` + `Set` per call; should be WeakMap-memoized on `(graph, node)`.
Evidence: `src/modules/materialization/Materializer.ts:137-178,209-259`. <- y fix it

**M-F-6.** `CHARACTERISTIC_TO_KEY` re-allocated per `addCharacteristic` call.
Evidence: `src/modules/registry/SchemaRegistry.ts:194-203`.
Fix: Hoist to module-level constant. <- y fix it

## Stability

**M-S-1.** `OntologyBuilder.addFromJsonLd` / `addShaclFromJsonLd` failure paths untested.
Evidence: `src/modules/ontology/OntologyBuilder.ts:50,74`.
Fix: Add tests with malformed JSON-LD documents; wrap rejections in typed `OwlImportError`. <- y fix it

**M-S-2.** `COMPUTED_INPUT_FORBIDDEN`, `DIALECT_UNSUPPORTED`, `VOCABULARY_UNSUPPORTED` tests assert on message regex, not `err.code`.
Evidence: `test/unit/computed.test.ts:138`; `test/unit/graph.test.ts:3302-3316`; `test/unit/schemaRegistry.test.ts:243`.
Fix: Standardize — `err instanceof XxxError && err.code === 'EXACT_CODE_VALUE'`, separate from message content checks.  <- y fix it

---

# Tier 4 — LOW — polish / opportunistic  <- y fix all of them

- `SchemaGraph.keywordValue` public method allows raw `node.schema[key]` reads. Evidence: `src/modules/graph/SchemaGraph.ts:361-367`. Precedent risk only.
- Blank node identity not preserved across `toQuads → fromQuads` without explicit skolemization; arrays of structurally identical objects deduplicate. Evidence: `src/modules/rdf/Projection.ts:371-374`.
- `owl:sameAs` is a side-store (`SameAsStore`), not a graph relation — not visible to `toTbox`/`toShacl`. Evidence: `src/modules/registry/SameAsStore.ts`; `src/JsonTology.ts:1146-1148`.
- `setOne()` / `setKeyed()` unconditionally call `delete()` → double revision-bump → false ontology-cache invalidation. Evidence: `src/modules/registry/SchemaRegistry.ts:1024,1043`.
- `NormalizedToQuadsOptionsType` not exported from `src/types/index.ts`; also it's an `interface` with a `Type` suffix in `src/types/` (double convention violation). Evidence: `src/types/NormalizedToQuadsOptions.ts:3`.
- CHANGELOG v0.13.2 entry uses delta language ("No code changes vs v0.13.1"), violating the present-tense rule. Evidence: `CHANGELOG.md:63-69`.
- Smoke tests import from `../../src/`, not from `dist/` subpath exports — won't catch broken `exports` map. Evidence: `test/smoke/docExamples.test.ts`, `test/smoke/baseTypes.test.ts`.
- Several blank-node assertions use insertion-order-sensitive `_:b1` values; doesn't flake today but the test names misleadingly imply counter-stability guarantees. Evidence: `test/integration/ontologySerialization.test.ts:1588,1593`.
- `ComputedStore`, `InvariantStore`, `SameAsStore` have no interfaces (internal, lower priority than `OntologyBuilder`).
- `DispatcherFn` type alias in `OwlImporter.ts:399` should move to `src/interfaces/OwlImport.ts`.

---

# Recommended sequence

Batched to minimize churn — items in the same phase share root cause or touch the same files.

## Phase 1 — Stop-the-bleed (~1 day)

C-2 (`validate` signature), C-3 (`LoadError` dead surface), H-6 (README/jsonld). Pure contract corrections; no architecture risk.

**Files.** `src/JsonTology.ts`, `src/interfaces/SchemaRegistry.ts`, `src/index.ts`, `README.md`.

**Acceptance.** Tests pass; lint/type-check clean. README install snippet matches `package.json`.

## Phase 2 — Wire-format consistency (~2–4 days)

C-1 (CURIE-at-rest), H-3 (Lift normalization direction), H-4 (`quad.graph` mutation), H-5 (`anyOf`/`oneOf` distinction). All trace to the same root cause. Fixing C-1 simplifies H-3 and H-4 and unblocks dead-code removal in `Lists.ts` and `JsonLdFormatter.ts`.

**Files.** `src/constants/IRI.ts`, `src/constants/XSD_MAPS.ts`, `src/modules/rdf/XsdTypes.ts`, `src/modules/rdf/QuadFactory.ts`, `src/modules/rdf/Projection.ts`, `src/modules/rdf/Lift.ts`, `src/modules/rdf/Lists.ts`, `src/modules/rdf/JsonLdFormatter.ts`, `src/modules/graph/SchemaGraphRelations.ts`, all OWL/SHACL projection consumers.

**Acceptance.** All existing tests pass after compact-form expectations are updated to full IRIs. New unit test: every term emitted by `Projection.abox`, `OwlProjection.graph`, and `ShaclProjection.graph` (called without `{ curie }`) carries full IRIs in `term.value`. Round-trip test for `anyOf` ≠ `oneOf` semantics.

## Phase 3 — Concurrency hazard (~½ day)

H-7 (blank-node counter). Single hot-path fix + one test.

**Files.** `src/modules/rdf/QuadFactory.ts`, `src/modules/rdf/Projection.ts`, new `test/unit/quads.concurrency.test.ts`.

**Acceptance.** `Promise.all([toQuads(...), toQuads(...)])` produces non-colliding blank node IRIs.

## Phase 4 — Round-trip coverage (~1 day)

C-4 (cross-schema `$ref` round-trip), H-8 (error code contracts).

**Files.** `test/e2e/ontologyRoundTrip.test.ts` (remove the skip; add the cross-schema case), various `test/unit/*.test.ts` (add `.code` assertions). Optionally remove `BOOLEAN_SCHEMA_FRAGMENT` and the unreachable `OwlImportErrorCode` values from `src/constants/ERROR_CODES.ts` and `src/types/ErrorCodes.ts`.

**Acceptance.** Every public error code has at least one test that pins `err.code === '...'`.

## Phase 5 — Graph completeness (~2 days)

H-1 (`jt:restrictions`), H-2 (primitive `format`). Same pattern — extend `SchemaGraphSemanticsInterface` and `SchemaGraphRelations.extractRelations`; collapse the raw-schema reads in `OwlProjection` to relation iterators.

**Files.** `src/interfaces/SchemaGraph.ts`, `src/modules/graph/SchemaGraphRelations.ts`, `src/modules/rdf/OwlProjection.ts`. Possibly `src/modules/ontology/OwlImporter.ts` (import side).

**Acceptance.** `fromTbox(toTbox())` round-trips `jt:restrictions` and primitive `format` annotations.

## Phase 6 — Performance pass (~1–2 days)

H-9, H-10, H-11, H-12 plus M-F-* items. All independent; measure with a new `toQuads`/`validate` benchmark first.

**Files.** `src/modules/graph/GraphEngine.ts`, `src/modules/rdf/Curie.ts`, `src/modules/rdf/QuadFactory.ts`, `src/modules/rdf/Projection.ts`, `src/modules/registry/SchemaRegistry.ts`, `src/modules/materialization/Materializer.ts`, new `bench/toQuads.bench.ts`.

**Acceptance.** New benchmark exists and runs in CI. Each fix shows a measurable reduction in either allocations or call time.

## Phase 7 — Pattern cleanup (rolling)

H-13, H-14, H-15 + Tier 3 / Tier 4 items. Tackle opportunistically per PR rather than as a single batch — touches many files.

**Files.** `src/types/**`, `src/interfaces/**`, `src/JsonTology.ts`, individual module files.

**Acceptance.** No `export interface` declarations remain in `src/types/`. No internal barrel imports through `src/modules/*/index.ts` re-exports. `OntologyBuilder` carries an `implements` clause.

---

# Test infrastructure gap (not severity-ranked)

A `bench/toQuads.bench.ts` is the single highest-leverage piece of test infrastructure missing. Every performance fix in Phase 6 lacks a regression guard today. Existing benchmarks cover `validate`, `instantiate`, `coerce`, `serialize/dump`, `registry`, `compose`, `transform`, `loops`, `owlImport`, and `owlCodegen` — but the ABox projection path (the most allocation-heavy surface) is unbenchmarked.

Add as part of Phase 6 Acceptance.
