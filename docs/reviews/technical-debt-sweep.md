# Technical-Debt Sweep & Remediation Plan

Repo-wide audit of json-tology (`src/**/*.ts`, ≈280 source files) across six
concerns: **type safety, pattern coherence, logging coverage, duplication,
onion-skin layering, and naming convention**. This document is the work plan.
Each wave is executed on a dedicated feature branch with a full
`type-check:all` + `eslint .` + test + `build` gate at every wave boundary.

This sweep is the successor to `docs/reviews/mechanical-pattern-audit.md`. That
prior audit codified error propagation, logging *style*, error-code discipline,
and the first layer of duplication/layering fixes. The invariants it established
are confirmed still intact here (0 bare `throw new Error`, 0 live `console.*`,
100% `logScope` adherence). This sweep targets the debt that audit did not
cover — naming, type-safety hardening, the remaining structural couplings, the
dead `Result<T>` idiom, and logging *coverage* (as opposed to style).

## Status: complete — all six waves landed and verified on `feature/technical-debt-sweep`

Open questions resolved: OQ1 → deleted `Result<T>` (keep throws); OQ2 → every
data-shape alias ends `*Type` (interfaces/types location gates enforced by lint;
the `*Type` suffix itself remains a documented convention, not yet a custom lint
rule); OQ2b → interface filename === exported symbol (now lint-enforced via
`filename-export/match-named-export`); OQ3 → new `src/modules/quads/` sublayer.

Committed as a wave-per-commit sequence (each green at `type-check:all` + `eslint`
+ `test:all` 3532 pass + `build`): quads extraction + naming migration; Wave 0
dedup/constants; Wave 1 `noUncheckedIndexedAccess` (~830 guard sites); Wave 1
narrowing completion; Wave 4 logging; Wave 5 enforcement.

Deliberately deferred (documented, not done): the three Wave-2 middle-layer
couplings (registry→materialization, materialization→validation,
materialization→rdf) — genuine runtime dependencies needing a deliberate API
decision; the IRI local-variable casing and `*Helpers.ts` renames (lowest-value
cosmetic); deep-core `trace` threading into `GraphEngine`/`RefResolution`
(logger-less hot paths). The `errors/ → modules/data/Path` import is permitted
(one-way use of the data substrate); the `constants/ → modules/` ban is the
lint gate that prevents the `XSD_MAPS`↔`XsdTypes` circular from returning.

A mid-sweep incident: a subagent running in a stale git worktree (forked from a
commit predating this work) leaked its edits back into the main tree, silently
reverting parts of Waves 0–1. Root cause: no commit checkpoint existed, so the
worktree forked from `HEAD` (which lacked the uncommitted work). Remediation:
commit each wave as it goes green so worktree agents fork from a correct base.

## Verified baseline (current state, directly confirmed)

These facts were checked against the tree at audit time, not inferred:

- `tsconfig.json` — `strict: true`; `exactOptionalPropertyTypes`, `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns` all on. `noUncheckedIndexedAccess`,
  `allowUnreachableCode: false`, `allowUnusedLabels: false` all **off**.
- `throw new Error(` / `throw new TypeError(` across `src/` — **0**.
- Runtime `console.*` across `src/` — **0** (all matches are JSDoc examples).
- Logger call sites — **22**, all using `logScope(component, operation, message)`.
- `Result<T>` class (`modules/data/Result.ts`) — **0** call sites, **0** imports
  outside its own file, absent from public entry points (`index.ts`, `value.ts`,
  `schema.ts`).
- `constants/XSD_MAPS.ts:106` re-exports `XsdTypes`; `modules/rdf/XsdTypes.ts:11`
  imports back from `XSD_MAPS.ts` — confirmed true runtime circular.
- `modules/registry/SchemaRegistry.ts:50` imports and `:973` constructs
  `Materializer` — confirmed backward import.
- `src/interfaces/` — 29 of 32 non-barrel files do not match their exported
  `*Interface` symbol name.

## Health scorecard

| Dimension         | Grade | Verdict                                                                                                                                                                              |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type safety       | A−    | strict throughout; 0 `any`, 0 `@ts-ignore`, 0 runtime `!`. 111 `as` casts, mostly load-bearing at generic-erasure boundaries. A few free hardening flags off.                        |
| Pattern coherence | B+    | Error hierarchy, serializer delegation, importDispatch shape, options-bag all uniform. One dead idiom (`Result<T>`); competing idioms in quad construction and `Lists` export shape. |
| Logging           | B     | Style flawless (100% `logScope`, 0 runtime `console.*`). Coverage thin: `info`/`fatal` unused, core execution paths dark, a handful of swallowed errors.                             |
| Duplication       | B     | Small and surgical: 4 private clones of exported `DispatchHelpers`, 2 inline `isRecord` re-impls, scattered magic IRIs. All quick wins.                                              |
| Layering          | B−    | Onion mostly intact; 1 true runtime circular + ~9 inward/backward imports, almost all from one root cause.                                                                           |
| Naming            | C+    | Errors/constants/classes clean. `src/types/` and `src/interfaces/` are a mid-abandoned migration — the single largest cluster by file count.                                         |

## Root causes

The debt concentrates in four systemic issues. Most individual findings are
downstream of one of these.

### ∵ RC1 — Abandoned naming migration in the inner layers

`src/interfaces/`: 29 of 32 files have a filename that does not match the
exported symbol. Three sub-patterns: plain missing suffix (`Logger.ts` exports
`LoggerInterface`), `*Impl.ts` files exporting `*Interface`
(`GraphEngineImpl.ts`, `MaterializerImpl.ts`, `SchemaCompilerImpl.ts`,
`SchemaGraphImpl.ts`, `ValueImpl.ts`), and complete divergence (`Projection.ts`
exports `IriMinterInterface`; `Ontology.ts` exports `OntologyBuilderInterface`;
`Serializer.ts` exports two interfaces). Only `CursorInterface.ts` and
`SchemaCursorInterface.ts` are correct — and they are inconsistent with the
other 30 by being correct.

`src/types/`: the `*Type` filename suffix is present on 53 of 219 files. The
remaining 166 omit it. The exported symbols are likewise split. This is a
convention applied to part of the tree and then abandoned mid-stream.

Highest file count, lowest individual risk, fully mechanical — but
import-path-destructive.

### ∵ RC2 — `rdf/` straddles two layers

`modules/rdf/` mixes **quad primitives** (`Terms`, `Curie`, `Lists`,
`QuadFactory`, `XsdTypes`, `IdentifierIssuer`) with **projection logic**
(`OwlProjection`, `ShaclProjection`, `Projection`, `Lift`, `VocabProjection`).
The primitives are a low layer; the projection is an outer layer. Because they
share a directory, every consumer of the primitives (`graph/`, `registry/`,
`materialization/`) is forced into a structurally backward import to reach them.

This single conflation produces: the `graph/ → rdf/` imports
(`AboxGraph.ts:42`, `QuadBackedSchemaGraph.ts:71-74`,
`SchemaGraphRelations.ts:8`), the `XSD_MAPS ↔ XsdTypes` true circular, the
`registry → rdf/Curie` import, and part of the `materialization → rdf/Projection`
coupling.

### ∵ RC3 — Dead / competing success-failure idiom

`Result<T>` (`modules/data/Result.ts` + `interfaces/Result.ts`) is fully
implemented (`pass`/`fail`/`map`/`orElse`/`unwrap`, `success: boolean`),
exported, and never used. Internal validation uses a `{ valid: boolean }`
struct (`CompiledValidationResultType`); the public registry API throws
(`InstantiationError`, `CoercionError`). Three distinct answers to "how does a
layer signal failure," one of which is dead surface area.

### ∵ RC4 — Logging coverage gap

The 22 call sites are impeccably formatted but unevenly distributed: `info` and
`fatal` are never emitted, `trace` appears only twice (both in
`SchemaRegistry`), and the entire `GraphEngine` / ref-resolution /
relation-building core has no instrumentation. A normal lifecycle cannot be
observed without enabling `warn`, which also surfaces genuine anomalies.

---

## Detailed findings

### 1 — Type safety (A−)

| Category                                          | Count    | Notes                                                                                                                            |
| ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `any` annotations                                 | 0        | —                                                                                                                                |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 0        | —                                                                                                                                |
| runtime non-null `!`                              | 0        | one in a JSDoc example only                                                                                                      |
| `eslint-disable` (type rules)                     | 2        | both documented structural necessities                                                                                           |
| `as` casts                                        | 111      | hotspots: `JsonTology.ts` (35), `Compose.ts` (18), `SchemaRegistry.ts` (11), `OwlImporter.ts` (10), `SchemaGraphSupport.ts` (10) |
| `as unknown as` double-casts                      | 8        | `JsonTology.ts` (5), `SchemaGraph.ts` (1), `OwlImporter.ts` (1), `SchemaRegistry.ts` (1)                                         |
| wide `object` input types                         | 6 sigs   | `OwlImporter.ts` (4), `JsonTology.ts` (2)                                                                                        |
| `unknown[]` where narrower exists                 | 2 fields | `Viz.ts` `owl`/`shacl`                                                                                                           |

Most `as` casts are load-bearing: generic type erasure at the `JsonTology`
facade (`387`, `869`), atomic private-field init in a static factory
(`SchemaGraph.ts:70`), dynamic-import opacity (`OwlImporter.ts:263`). Genuinely
soft spots worth fixing:

- `types/Viz.ts:67-72` — `owl`/`shacl` typed `unknown[]` though
  `serializeQuads()` returns `QuadInterface[]`. Free narrow.
- `modules/data/Result.ts:56-88` — six `as T` / `as ValidationErrors` casts
  forced by parallel `data`/`errors` fields. A real discriminated union removes
  all six (only relevant if `Result<T>` is adopted — see OQ1).
- `OwlImporter` / `JsonTology` `object` params — `Record<string, unknown>` (or
  `JsonLdDocInput`) is what the bodies actually require.
- `importDispatch/Characteristics.ts:149` — `as Array<{…}>` strips `readonly`
  to `push`.

Config: `tsconfig.test-types.json` is orphaned (referenced by no script) and
carries a curated include that excludes `inference-comparison.test.ts` — a
latent false-green per `project_type_test_gate`. Resolve by deleting or wiring
to a script.

### 2 — Pattern coherence (B+)

Uniform and confirmed: error hierarchy (0 bare throws), serializer delegation
(both serializers ≤20 lines, delegate to `*Projection.graph()`), importDispatch
contract (all 9 modules `(_quads, ctx) → fragment`, pure), options-bag for
multi-arg signatures, named exports.

Incoherences:

| Issue                                                                                                                         | Location                                                    | Severity                      |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| `Result<T>` defined + exported, never used                                                                                    | `modules/data/Result.ts`, `interfaces/Result.ts`            | High (see OQ1)                |
| `valid: boolean` (internal) vs `success: boolean` (`Result`) — two discriminant names for one concept                         | validation layer vs `Result.ts`                             | High                          |
| `asQuadObject` exported both standalone and as `Lists.asQuadObject`; `Lift.ts:47` uses one path, others the other             | `modules/rdf/Lists.ts:302,370`                              | Medium                        |
| `Terms.*` vs `QuadFactory.*` — boundary real (plain vs CURIE/validation-aware) but undocumented; `Projection.ts` imports both | 176 `QuadFactory` vs 60 `Terms` sites                       | Medium                        |
| inline plain-object guards instead of `isRecord`/`isPlainObject`                                                              | `SchemaCompilerPlan.ts:90-91`, `GraphEngineDefaults.ts:133` | Medium                        |
| `cli.ts` format dispatch as `if/else if` chain over string discriminant                                                       | `cli.ts:321,360`                                            | Low                           |
| `RefResolver.resolve` 4 positional params though `RefResolutionOptionsType` exists                                            | `validation/RefResolver.ts:22-26`                           | Low                           |
| two ref-resolution failure contracts: `resolveRef` throws, `RefResolver.resolve` returns `undefined`                          | `graph/RefResolution.ts` vs `validation/RefResolver.ts`     | Low (both scoped, documented) |

### 3 — Logging (B)

| Level | Sites | Status                           |
| ----- | ----- | -------------------------------- |
| trace | 2     | only in `SchemaRegistry`         |
| debug | 8     | thin                             |
| info  | 0     | **unused**                       |
| warn  | 8     | dominant — inverted from healthy |
| error | 4     | present                          |
| fatal | 0     | **unused**                       |

Injection is uniform: options-bag DI, `?? SILENT_LOGGER` default
(`JsonTology`, `SchemaRegistry`, `SchemaGraph`, `SchemaCompiler`, `Materializer`,
`OwlImporter`, `OntologyBuilder`). `GraphArtifact` and `RefDecoder` take a
per-call static logger param instead — workable, minor inconsistency.

Dark core paths: `GraphEngine` (+ `Scalars`/`Defaults`/`Support`),
`SchemaGraphRelations`, `RefResolution`, `PredicateResolver`,
`SchemaRefWalker`, `InvariantStore`, `FormatRegistry`.

Swallowed errors (catch with no log, no rethrow) — priority first:

| Location                              | Pattern                                | Assessment                                            |
| ------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `importDispatch/ClassAxioms.ts:75`    | `catch { return []; }` on `JSON.parse` | drops malformed OWL data silently — log at debug/warn |
| `cli.ts:226`                          | `catch { continue; }`                  | silently skips invalid `$id` URLs on load — log       |
| `cli.ts:148`                          | `catch { /* URL fallback */ }`         | intentional, but add `logger.debug`                   |
| `OwlImporter.ts:264`                  | `catch { return null; }`               | optional peer dep — intentional, leave                |
| `format/FormatRegistry.ts` (multiple) | `catch { return false; }`              | intentional validator sentinels — leave               |

### 4 — Duplication (B)

| Unit                                                             | Locations                                                                                                       | Canonical home                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `targetValue(relation)`                                          | `ClassAxioms.ts:57`, `ClassExpressions.ts:64`, `Datatypes.ts:62`, `Individuals.ts:110`, `ProjectionIndex.ts:88` | `DispatchHelpers.targetValue` (already exported)          |
| `relationsByPredicate`                                           | `ClassExpressions.ts:69`, `Datatypes.ts:67`                                                                     | `DispatchHelpers.relationsByPredicate` (already exported) |
| `literalString(relation)`                                        | `Annotations.ts:54`, `Datatypes.ts:95`                                                                          | promote to `DispatchHelpers`                              |
| `namedNodeIri` / `namedNodeTarget` (identical bodies, two names) | `Annotations.ts:80`, `Individuals.ts:79`                                                                        | one `DispatchHelpers` export                              |
| inline `isRecord`                                                | `SchemaCompilerPlan.ts:91`, `GraphEngineDefaults.ts:133`                                                        | `DataTypes.isRecord`                                      |
| trailing-slash strip loop                                        | `cli.ts:127`, `JsonTology.ts:834`                                                                               | `SchemaIri.normalizeBase` (new)                           |
| `rdf:_${n}` member template                                      | `SchemaGraphRelations.ts:289`, `OwlProjection.ts:1014`                                                          | `rdfMemberIri(n)` factory                                 |

Hardcoded values duplicating (or needing) constants: `OwlImporter.ts:152-218`
inline `owl:`/`rdf:` sets → `ONTOLOGY_PREDICATES`; `rdfs:label/domain/range`
literals across `OntologyBuilder.ts:140`, `GraphSchemaSerializer.ts:353-354`,
`SchemaGraphSupport.ts:471-473` → `RDFS.*`; missing constants
`JT_VALIDATION_PROBLEM_TYPE` (`ValidationErrors.ts:157`) and `JT_STATIC_BASE_IRI`
(`JsonTology.ts:95`).

### 5 — Layering (B−)

One true runtime circular: `constants/XSD_MAPS.ts ↔ modules/rdf/XsdTypes.ts`.
All other cycles flagged by `litany deps circular` are `import type`-only
(TypeScript-safe; litany does not distinguish type-only edges).

Inward/backward import violations:

| Importer                                           | Imported                                      | Type                        | Severity            |
| -------------------------------------------------- | --------------------------------------------- | --------------------------- | ------------------- |
| `constants/XSD_MAPS.ts:106`                        | `modules/rdf/XsdTypes`                        | inward (constants → module) | High (the circular) |
| `registry/SchemaRegistry.ts:50`                    | `materialization/Materializer`                | backward (lower → higher)   | High                |
| `types/ConversionContext.ts`                       | `modules/rdf/IdentifierIssuer`                | inward                      | Medium              |
| `types/EmitNodeShapeArgs.ts`                       | `modules/rdf/VocabProjection`                 | inward                      | Medium              |
| `types/EmitNodeShapeCompositionArgs.ts`            | `modules/rdf/VocabProjection`                 | inward                      | Medium              |
| `types/EmitQualifiedCardinalityRestrictionArgs.ts` | `modules/rdf/QuadFactory`                     | inward                      | Medium              |
| `materialization/Materializer.ts:29`               | `validation/SchemaCompilerDefaults`           | peer coupling               | Medium              |
| `graph/AboxGraph.ts:42`                            | `modules/rdf/Terms`                           | backward                    | Medium (RC2)        |
| `graph/QuadBackedSchemaGraph.ts:71-74`             | `modules/rdf/{Curie,Terms,Lists,QuadFactory}` | backward                    | Medium (RC2)        |
| `graph/SchemaGraphRelations.ts:8`                  | `modules/rdf/XsdTypes`                        | backward                    | Medium (RC2)        |
| `errors/ValidationErrors.ts:11`                    | `modules/data/Path`                           | inward                      | Low                 |
| `types/Brand.ts`                                   | (runtime `brand()` in types/)                 | layer contamination         | Low-Medium          |
| `types/BaseTypes.ts:7`                             | `modules/data/BaseTypes`                      | inward re-export            | Low                 |

No parallel semantic model: both projections read `graph.allRelations()` via
`SchemaGraphInterface`; ontology output is a true serialization of the canonical
graph, as the architecture requires.

### 6 — Naming (C+)

Clean: `src/errors/` (`*Error`), `src/constants/` (`SCREAMING_SNAKE`), module
class names (match filenames).

Clusters (all under RC1 plus a few strays):

- `src/interfaces/` — 29 filename↔symbol mismatches; 5 are `*Impl.ts` →
  `*Interface`; `Serializer.ts` exports two interfaces (split needed).
- `src/types/` — `*Type` suffix on 53/219; settle one rule and apply (see OQ2).
- `types/Compose.ts:590,623,656` — three `type` aliases named `*Interface`
  (`SubClassOfSchemaInterface` etc.) → should be `*Type`.
- `SubjectTypeType.ts` — doubled `Type` suffix.
- `doCoerce` boolean field (`ValidationRunOptionsType.ts:5`, `ExecContext.ts:8`)
  → `coerce`.
- `process*` / `handle*` private functions (8) in `importDispatch/` and
  `VocabProjection.ts` → domain verbs.
- `*Helpers.ts` (`DispatchHelpers.ts`, `ProjectionHelpers.ts`) → domain names.
- `IRI` (variables) vs `Iri` (types) — type-level split is defensible; only
  local-variable casing (`baseIRI`/`graphIRI` vs `subjectIri`) needs settling.

---

## Remediation plan

Sequenced sprout-and-swap; the tree builds and the full gate passes at every
wave boundary. Effort is rough engineering-days. Risk is the chance a wave
widens its blast radius beyond its brief.

### Wave 0 — Quick wins · ~1d · low risk

1. De-duplicate `DispatchHelpers`: import `targetValue` / `relationsByPredicate`
   in the 5 consumers; promote `literalString` and one of
   `namedNodeIri`/`namedNodeTarget` to the shared module; delete the clones.
2. Replace the 2 inline `isRecord` re-implementations.
3. Magic IRIs → constants (`ONTOLOGY_PREDICATES`, `RDFS.*`); add
   `JT_VALIDATION_PROBLEM_TYPE`, `JT_STATIC_BASE_IRI`, `rdfMemberIri(n)`.
4. Extract `SchemaIri.normalizeBase` and route both trailing-slash sites
   through it.
5. Remove the `xsdToJsonSchema` wrapper (`Properties.ts:58-59`); call the map
   directly.

Gate: full suite. No public API change.

### Wave 1 — Type-safety hardening · DONE

1. Enabled `noUncheckedIndexedAccess`, `allowUnreachableCode: false`,
   `allowUnusedLabels: false`. The initial estimate of "zero fixes" was wrong:
   the flag propagates through `tsconfig.json` into the examples and tests
   configs (both `extends` it), so it surfaced real fixes across ~20 `src`
   files, ~23 example/script files, and 40 test files (≈460 indexed-access
   sites). All fixed properly with explicit guards or `arr.at(i)?.` — no `!`,
   no casts, no flag-scoping. (The lint rule `no-unnecessary-condition`
   mishandles bracket-index optional chains under this flag; `arr.at(i)?.x`
   satisfies both tsc and the linter, so it is the canonical fix pattern.)
2. Narrowed `VizDataType.owl`/`shacl` → `readonly QuadInterface[]`.
3. Deleted the orphaned `tsconfig.test-types.json` (zero references).
4. Replaced wide `object` params in `OwlImporter`/`JsonTology`/`owl-gen`/`cli`
   with `Record<string, unknown>`; the `isRecord` guard narrows the JSON-LD
   parse path cleanly (removed two `as` casts).

Gate at completion: `type-check:all` 0, `eslint` clean, 3540 tests pass, build
green.

### Wave 2 — Layering: extract quad primitives · DONE (with 3 documented carve-outs)

Completed:
1. `src/modules/quads/` created; `Terms`, `Curie`, `Lists`, `QuadFactory`,
   `XsdTypes`, `IdentifierIssuer` moved there (true `git mv`, no shims — the 27
   test/example imports were repointed to `quads/`). `QuadFactory` split: its
   projection-emit methods (`emitConstraintLiteral`, `emitLiterals`) moved to a
   new `rdf/QuadEmit.ts`, leaving `QuadFactory` a pure primitive.
2. The `XSD_MAPS ↔ XsdTypes` true runtime circular is eliminated (the dead
   re-export removed). `litany deps circular` now reports only `import type`
   cycles (TypeScript-safe).
3. `graph/` and `registry/` no longer import `rdf/` at all (they import
   `quads/`). The two `types/` inward imports removed (`ConversionContext` →
   `IdentifierIssuerInterface`; `EmitQualifiedCardinalityRestrictionArgs` →
   `QuadObjectType`). `Lists` consolidated to the `Lists` namespace (18 callers
   vs 1 standalone).
4. Runtime purged from `types/`: `brand()` moved to `modules/data/Brand.ts`
   (types kept in `types/Brand.ts`); `types/BaseTypes.ts` deleted, its value
   re-export routed through the entry barrel.
5. `Result<T>` deleted (`modules/data/Result.ts`, `interfaces/Result.ts`) per
   OQ1, with its 8 dead tests removed.

Gate at completion: `type-check:all` 0, `eslint` clean, 3532 tests pass, build
green, no true runtime circular.

Carved out — three middle-layer couplings reflect genuine runtime dependencies,
not mechanical mis-imports, and breaking them touches core runtime / public API.
They are recorded here for a deliberate follow-up decision rather than forced
mid-sweep:
- **`registry → materialization`**: `SchemaRegistry.create()` constructs a
  `Materializer` to synthesize default instances. `create()` is public surface;
  a clean break needs an injected default-value factory or moving the method.
- **`materialization → validation`**: `Materializer` builds default values via a
  context that uses validation's `RefResolver` (dynamic-`$ref` resolution). The
  dependency is real; breaking it needs a shared default-synthesis service with
  its own ref-resolution abstraction.
- **`materialization → rdf/Projection`**: ABox projection emits RDF, so this is
  largely inherent; revisit only if ABox output is decoupled from `rdf/`.

These three are excluded from the Wave 5 leaf-layer import rules (which target
`types/`/`interfaces/`/`constants/`/`errors/`, where zero violations now remain).

### Wave 3 — Naming migration · ~2d · low risk, high churn · depends on OQ2 · run in isolation

Scripted rename per cluster, build-verified between each (git-tracked renames):

1. `src/interfaces/*` filenames → match exported `*Interface` symbol (29
   renames); split `Serializer.ts`.
2. `src/types/*` → apply the OQ2 rule across the board.
3. `Compose.ts` `*Interface` aliases → `*Type`; `SubjectTypeType` → rename
   concept; `doCoerce` → `coerce`; `process*`/`handle*` → domain verbs;
   `*Helpers.ts` → domain names; settle local-variable IRI casing.

Gate: full suite. No other wave in flight (import-path churn).

### Wave 4 — Logging coverage · ~1-1.5d · low risk

1. Document level semantics (`info` = lifecycle boundary; `fatal` =
   intentionally unused).
2. Add `info` at phase boundaries (`SchemaRegistry.seal`, graph build, compile
   complete, `Materializer.run`); add `trace` in `GraphEngine` dispatch /
   `RefResolution` / `SchemaRefWalker`.
3. Thread loggers into the dark core; verify end-to-end propagation
   (`JsonTology → SchemaRegistry → SchemaGraph/SchemaCompiler`).
4. Fix swallowed errors — `ClassAxioms.ts:75` and `cli.ts:226` first.

Gate: full suite.

### Wave 5 — Codify enforcement · ~1d · depends on Waves 2-3 landing

1. ESLint rule: ban non-type imports in `src/types/**` and `src/interfaces/**`.
2. ESLint rule: ban `src/constants/**` and `src/errors/**` from importing
   `src/modules/**`.
3. Check: interface filename === exported symbol.
4. Keep `litany deps circular` as a hard gate (green after Wave 2).

Sequencing: Waves 0–1 land immediately and independently. Wave 5's rules fail
until Waves 2–3 land. Wave 3 runs alone.

---

## Open questions — resolution notes

The two structural decisions below gate Waves 2–3. A third sub-decision (OQ3)
falls out of OQ-resolution. Options, tradeoffs, and a recommendation are given
for each; record your decision inline.

### OQ1 — `Result<T>`: delete or adopt?

`Result<T>` is fully built but dead (0 call sites, 0 imports, not in public
entry points). The library currently signals failure two other ways:
`{ valid: boolean }` structs internally, thrown typed errors at the public API.

**Option A — Delete `modules/data/Result.ts` + `interfaces/Result.ts`.** <- remove it keep throws
- For: removes dead public surface; eliminates the `valid` vs `success`
  discriminant confusion; smallest, safest change; nothing depends on it.
- Against: discards a complete monadic Result that may be wanted later; if a
  future need arises it must be rebuilt or pulled from git history.
- Effort: trivial. Risk: none (verified unused).

**Option B — Adopt at the public boundary**, returning `Result<T>` from
`instantiate`/`coerce`/`validate` instead of throwing.
- For: gives consumers typed, non-throwing failure handling; a single failure
  idiom at the API edge; lets the discriminated-union refactor remove the six
  internal `as` casts in `Result.ts`.
- Against: breaking public API change (throw → return) — a major-version
  concern even at 0.x; large surface to migrate (`JsonTology.*`, registry,
  every consumer + docs + examples + tests); the throw idiom is currently
  uniform and well-understood.
- Effort: high. Risk: high (public contract).

**Option C — Keep as-is (documented internal utility).**
- For: zero work now; available if an internal caller wants it.
- Against: it is exported on the public surface, not internal; "available but
  unused" is exactly the debt this sweep exists to remove; the discriminant
  confusion persists.
- Effort: none. Risk: the debt simply remains.

**Recommendation: A (delete).** It is dead public surface today and git history
preserves it. Adopt later as a deliberate API design (Option B) if and when
non-throwing failure handling becomes a real requirement, where it can be
designed as a proper discriminated union from the start. Choosing B now couples
a large API migration to a tech-debt sweep, which the standards discourage.

> **Resolution: Option A.** Delete `modules/data/Result.ts` and
> `interfaces/Result.ts`; keep the thrown-error idiom at the public boundary.
> Git history preserves the implementation for future deliberate adoption.

### OQ2 — Canonical `src/types/` filename rule

Today: `*Type` suffix on 53/219 type files; the rest omit it; symbol names are
likewise split. A single rule must be chosen and applied tree-wide in Wave 3.

**Option A — Filename === exported symbol, verbatim.**
`BuildOptionsType` lives in `BuildOptionsType.ts`; `JsonSchema` lives in
`JsonSchema.ts`. The suffix question moves entirely to the symbol name (OQ2b).
- For: one trivially enforceable rule (filename matches default export);
  mirrors the rule proposed for `src/interfaces/`; a lint check is easy.
- Against: does not by itself decide whether symbols carry `*Type` — needs
  OQ2b; renames most of the 53 currently-suffixed files if OQ2b lands on "no
  suffix," or most of the 166 unsuffixed if it lands on "suffix."

**Option B — Every data-shape alias ends in `*Type`; filename matches.** <- yes this one
Object/union/intersection shapes get `*Type`; the file is named for it.
Structural utility aliases (e.g. `RelationStructure`, mapped/transform types)
may omit the suffix.
- For: `*Type` becomes a reliable signal of "data shape," consistent with the
  existing `type`-is-the-substrate doctrine and `feedback_type_vs_interface`;
  the larger existing convention direction (53 files already suffixed) is
  completed rather than reverted.
- Against: highest churn (rename the 166 unsuffixed); the "structural utility
  exception" needs a crisp definition or it becomes a judgment call (and a
  future inconsistency vector).

**Option C — No suffix anywhere; filename === symbol, no `*Type`.**
Drop `Type` from the 53 that have it.
- For: shortest names; filename rule still trivial.
- Against: reverts the established direction; loses the at-a-glance "this is a
  data type" signal; conflicts with the suffix convention already used for many
  symbols and with `feedback_type_vs_interface` framing.

**Recommendation: B**, with the structural-utility exception written as an
explicit allowlist predicate in the lint rule (not left to judgment): a `type`
alias may omit `*Type` only if it is a generic/mapped/conditional transform
(takes a type parameter or uses `keyof`/`infer`/indexed access), never if it
defines a concrete object or union shape. This completes the existing migration
direction and makes the suffix meaningful and enforceable.

> **Resolution: Option B.** Every concrete data-shape alias (object, union,
> intersection) ends `*Type`; the file is named for the symbol. A `type` alias
> may omit `*Type` only when it is a generic/mapped/conditional transform (takes
> a type parameter or uses `keyof`/`infer`/indexed access). Wave 5 lints this.

### OQ2b — Sub-decision under OQ2: `*Interface` filename rule (low contention)

Proposed: every `src/interfaces/` file is named for its exported `*Interface`
symbol; one interface per file. This renames the 29 mismatches (including the 5
`*Impl.ts`) and splits `Serializer.ts`. Low contention — included here only for
explicit sign-off since it is import-path-destructive.

> **Resolution: Approved.** Rename all 29 mismatched files to match their
> `*Interface` symbol; the 5 `*Impl.ts` files become `*Interface.ts`; split
> `Serializer.ts` into one file per exported interface.

### OQ3 — Quad-primitive sublayer location (falls out of Wave 2)

The RC2 fix moves `Terms`, `Curie`, `Lists`, `QuadFactory`, `XsdTypes`,
`IdentifierIssuer` to a layer between `data/` and `graph/`.

**Option A — `src/modules/quads/`.** New top-level module dedicated to rdf/js <- This one
term + quad primitives.
- For: names the concept precisely; clean import paths
  (`modules/quads/QuadFactory`); obvious home for future primitives.
- Against: one more top-level module directory.

**Option B — `src/modules/data/rdf/`.** Nest primitives under the existing data
substrate.
- For: signals "low-level substrate"; no new top-level concept; sits naturally
  below `graph/`.
- Against: `data/` currently holds non-rdf utilities; mixing rdf specifics in
  may blur its purpose.

**Recommendation: A (`modules/quads/`).** The primitives are a coherent,
nameable concern (rdf/js term construction) distinct from the generic `data/`
substrate, and a dedicated module makes the layering rule
("`graph/` may import `quads/`, never `rdf/`") legible and lintable.

> **Resolution: Option A.** Create `src/modules/quads/` and move `Terms`,
> `Curie`, `Lists`, `QuadFactory`, `XsdTypes`, `IdentifierIssuer` into it.

---

## Enforcement summary (Wave 5 deliverables)

Each rule below converts a finding class into a commit-time gate so the debt
cannot silently return — the same discipline `mechanical-pattern-audit.md`
applied to error codes and bare throws.

- No non-type imports in `src/types/**`, `src/interfaces/**`.
- No `src/modules/**` imports from `src/constants/**`, `src/errors/**`.
- Interface filename === exported symbol; one interface per file.
- `src/types/` filename rule per OQ2 (with the structural-utility allowlist).
- `litany deps circular` green as a hard gate.
- The `Terms`/`QuadFactory` and `quads/` vs `rdf/` boundaries documented in
  `docs/architecture.md`.
