# Test Suite Consolidation Audit — 2026-05

Scope: 82 test files, ~40,757 LOC, ~2,178 assertions. Scenario-table runners exist in 4 files (`composeEdgeCases`, `materializerEdgeCases`, `serializationEdgeCases`, `transformValueEdgeCases`) plus `roundTrip`, `quadRoundTrip`, `compiledInterpretedParity`, `docExamples` — most other files are flat `void it(...)` with duplicated setup. Bookstore domain assumed for proposed fixtures (Book, Author, Order, Customer, Isbn).

## 1. Consolidation Audit

| Domain | Files | LOC | Asserts | Recommendation |
|---|---|---|---|---|
| compose | composition, composeEdgeCases, composeEquivalent, composeExtendAllOf, compositionExec | 2212 | 237 | **MERGE** → `test/unit/compose.test.ts` (delete 4 sibling files; fold `compositionExec` only after rewriting against the public API — see §3) |
| validation | conditionalValidation, discriminatorValidation, containsValidation, patternPropertiesValidation, validationEdgeCases, compilerConformance, validationErrorsViews, arrays, objects, scalars | 6791 | 276 | **MERGE** → `test/unit/validation.test.ts` (one scenario table per keyword family); keep `compilerConformance.test.ts` separate since its assertion is parity, not behavior |
| instantiation/coerce | aliasCoercion, refAndNesting, strictField, frozenOutput, enableDefaults, enableStrictGraph | 1492 | 54 | **MERGE** → `test/unit/instantiate.test.ts` |
| transform/value | transform, value, operations, hash, lift, transformValueEdgeCases | 2863 | 182 | **MERGE** the three edge files into `value` and `transform`; KEEP `hash` and `lift` (distinct surfaces) |
| registry | configInheritance, findDuplicates, formatRegistry, schemaLoader, customKeywords, resolverMerge, schemaRegistry (int) | 2244 | 142 | **MERGE** → `test/unit/registry.test.ts` + keep `test/integration/schemaRegistry.test.ts` for cross-module |
| serialization (RDF/OWL/SHACL) | jsonLdFormatter, projectionIndex, serializerUtils, tboxToshacl, dump, graphSchemaSerializer, quadProjection, quadRoundTrip, roundTrip, serializationEdgeCases, shaclSerializer, ontologyBuilder, vocabularyPlugin | 8601 | 574 | **MERGE** unit-side into `test/unit/serialization.test.ts`; keep one big integration `test/integration/ontologySerialization.test.ts` covering OWL+SHACL+JSON-LD round-trip with one scenario table |
| graph/relations | schemaGraph, relations, domainRange, graphArtifact, schemaEngine, schemaIri | 4318 | 337 | **MERGE** → `test/unit/graph.test.ts`; `schemaEngine` (1707 LOC, 32% weak `assert.ok`) needs strengthening before folding |
| errors | errorHandling, invariants | 820 | 70 | KEEP both — distinct contracts (error chain vs invariant predicate) |
| format/datatypes | curie, dataTypes, xsdDatatypePrecision, xsdMaps | 878 | 68 | **MERGE** → `test/unit/datatypes.test.ts` |
| registry-options/api | apiUnification, staticCounterparts, computed, productionHardening, jsonTology(int), compiledInterpretedParity(int) | 3092 | 184 | KEEP `jsonTology.test.ts` (canonical public-API integration); MERGE `apiUnification` + `staticCounterparts` into it; KEEP `computed`, `productionHardening` (distinct lifecycles) |
| materialize | materializer, materializerEdgeCases | 1208 | 54 | **MERGE** → `test/unit/materialize.test.ts` |

Net: 11 merge groups collapsing ~50 files into ~12.

## 2. Scenario-Runner Pattern Audit

Sample of 10 files for runner adoption:

| File | LOC | Runner? | Foldable | Est. LOC after |
|---|---|---|---|---|
| composition.test.ts | 1260 | partial (some `for of` mid-file) | yes — every `extend/intersection/pick/omit/...` block is a scenario family | ~450 |
| compositionExec.test.ts | 299 | no | yes — uniform `(validators, expected) → result.valid` shape | ~120 |
| conditionalValidation.test.ts | 683 | no | **yes — strongest candidate** (every `it` is `register schema → validate → assert errors`) | ~180 |
| containsValidation.test.ts | 659 | no | yes | ~180 |
| patternPropertiesValidation.test.ts | 830 | no | yes | ~220 |
| schemaEngine.test.ts | 1707 | no — flat blocks of 50+ `is(sid, d)` calls | yes — already shaped as `(sid, d, exp)` tuples | ~400 |
| jsonTology.test.ts (int) | 781 | yes (uses `for (const [name, scenario])`) | already idiomatic | KEEP |
| ontologyBuilder.test.ts | 791 | partial | yes — fold ontology serializer assertions into `OwlScalarScenario`-shape rows | ~300 |
| roundTrip.test.ts | 1720 | yes (interface RoundTripScenario) | already idiomatic | KEEP |
| quadProjection.test.ts | 1201 | no | yes — projection emits known quad sets per schema | ~400 |

**Top 5 refactor targets** (highest LOC reduction, lowest risk):

1. `schemaEngine.test.ts` — 1707 → ~400 (every block is `[sid, data, expected]`).
2. `compilerConformance.test.ts` — 1804 → ~500 (already calls `assertConformance(schema, data, expected)` — table-ize the 24 describes into one).
3. `patternPropertiesValidation.test.ts` — 830 → ~220.
4. `conditionalValidation.test.ts` — 683 → ~180.
5. `containsValidation.test.ts` — 659 → ~180.

Combined: ~5683 LOC → ~1480 LOC (saves ~4200).

## 3. Behavioural vs White-Box Audit

- Public-API only (`src/index.js` or `src/JsonTology.js`): **17 files**
- Reaches into `src/modules/...`: **59 files**
- Reaches into `src/types/` or `src/interfaces/`: ~12 (often legitimate for type-asserting tests)

Sample of 5 internal-reach files:

| File | Internal | Necessary? |
|---|---|---|
| composeEquivalent.test.ts:8 | `Compose`, `SchemaRegistry` | **circumstantial** — replaceable with `JsonTology.create({schemas:[Compose.equivalent(...)]}).validate(...)` |
| composition.test.ts:11 | `Compose`, `Result`, `SchemaRegistry`, `ValidationErrors` | **circumstantial** — observe through `JsonTology.is/validate` |
| compositionExec.test.ts:5 | `Composition` (dispatcher) | **necessary in isolation** but contract is observable via `validate()` — delete and fold |
| relations.test.ts:7 | `SchemaGraph` | **partly necessary** — relations surfaced via `ontology().jsonLd()` should move to public-API tests |
| schemaEngine.test.ts:11 | `SchemaRegistry`, `GraphEngine` | **circumstantial** — every `is(sid, data)` equals `JsonTology.is()` |

Verdict: of 59 internal-reach files, ~35 are circumstantial. Migration is the single largest hygiene win.

## 4. Assertion-Quality Audit

Sample of 10 files. Weak = bare `assert.ok(...)`; strong = `deepEqual`/`strictEqual`/`equal` with hardcoded expected.

| File | weak | strong | weak% |
|---|---|---|---|
| customKeywords | 2 | 9 | 18% |
| conditionalValidation | 0 | 11 | 0% |
| refAndNesting | 2 | 2 | **50%** |
| discriminatorValidation | 0 | 4 | 0% |
| containsValidation | 0 | 9 | 0% |
| compilerConformance | 1 | 5 | 17% |
| hash | 0 | 3 | 0% |
| compiledInterpretedParity | 0 | 3 | 0% |
| roundTrip | 0 | 7 | 0% |
| schemaEngine | 6 | 13 | **32%** |

Files where >30% of assertions are weak (full scan):

- `quadProjection.test.ts` — 71 `assert.ok` of 91 (78%)
- `ontologyBuilder.test.ts` — 55 of 113 (49%)
- `serializationEdgeCases.test.ts` — 41 of 62 (66%)
- `validationEdgeCases.test.ts` — 35 of 47 (74%)
- `relations.test.ts` — 31 of 88 (35%)
- `schemaRegistry.test.ts` (int) — 31 of 71 (44%)
- `schemaEngine.test.ts` — 32%
- `refAndNesting.test.ts` — 50%

These should be strengthened *during consolidation* (every `assert.ok(x)` → `assert.deepEqual(x, expected)` with literal expected, OR dropped if existence is genuinely the contract).

## 5. Public-API Coverage Gaps

Walking `src/JsonTology.ts` against `apiUnification`, `staticCounterparts`, `jsonTology` (int), `quadRoundTrip`, `vocabularyPlugin`, `productionHardening`, `errorHandling`:

| Method | Happy | Failure | Boundary |
|---|---|---|---|
| `create`/`register`/`registerAnonymous` | ✓ | ✓ | partial |
| `validate`/`is` | ✓ | ✓ | ✓ |
| `instantiate` | ✓ | ✓ | partial |
| `materialize` | ✓ | partial | partial |
| `dump`/`dumpJson` | ✓ | **gap** | partial |
| `encode` | minimal | **gap** | **gap** |
| `toQuads`/`fromQuads` | ✓ | **gap** | **gap** |
| `subschemaAt` | partial | **gap** | **gap** |
| `ontology`/`toShacl`/`toTbox` | ✓ | partial | partial |
| `addComputed`/`addInvariant` (and `remove*`) | ✓ | partial | duplicate-name untested |
| `get`/`has`/`list`/`toSchema` | ✓ | n/a | partial |
| static `JsonTology.dump`/`instantiate`/`materialize`/... | ✓ | **gap** | **gap** |

Punch list: `dump/dumpJson` failures, `encode` end-to-end, `toQuads/fromQuads` boundaries, `subschemaAt` invalid-pointer (`GraphError`), static-counterpart failures, computed/invariant lifecycle (duplicate, replace, remove-missing).

## 6. Concrete Recommendations

**Phase 1 — Pure consolidation (one PR each, no behavior change):**

| New file | Sources to delete |
|---|---|
| `test/unit/compose.test.ts` | composition, composeEdgeCases, composeEquivalent, composeExtendAllOf (delete `compositionExec` — fold into validation) |
| `test/unit/validation.test.ts` | conditionalValidation, discriminatorValidation, containsValidation, patternPropertiesValidation, validationEdgeCases, validationErrorsViews, arrays, objects, scalars, compositionExec |
| `test/unit/instantiate.test.ts` | aliasCoercion, refAndNesting, strictField, frozenOutput, enableDefaults, enableStrictGraph |
| `test/unit/registry.test.ts` | configInheritance, findDuplicates, formatRegistry, schemaLoader, customKeywords, resolverMerge |
| `test/unit/datatypes.test.ts` | curie, dataTypes, xsdDatatypePrecision, xsdMaps |
| `test/unit/materialize.test.ts` | materializer, materializerEdgeCases |
| `test/unit/graph.test.ts` | schemaGraph, relations, domainRange, graphArtifact, schemaEngine, schemaIri |
| `test/unit/serialization.test.ts` | jsonLdFormatter, projectionIndex, serializerUtils, tboxToshacl, dump |
| `test/integration/ontologySerialization.test.ts` | graphSchemaSerializer, quadProjection, quadRoundTrip, roundTrip, serializationEdgeCases, shaclSerializer, ontologyBuilder |
| (fold) `test/integration/jsonTology.test.ts` | absorb apiUnification, staticCounterparts |

**Phase 2 — Public-API migration:** rewrite `compose.test.ts`, `composition`-derived assertions, and `schemaEngine`-derived `is/validate` cases against `JsonTology.create({schemas})`. Drop `Compose`, `SchemaRegistry`, `GraphEngine`, `Composition`, `Result` imports. Keep `SchemaGraph`/`GraphArtifact` direct access only where the public API genuinely cannot observe.

**Phase 3 — Assertion strengthening:** in flagged files replace each `assert.ok(...)` with `assert.deepEqual` against a literal expected. For non-deterministic values (blank node IDs) normalize via `serializerUtils`.

**Phase 4 — Coverage gaps:** add scenarios for `dump/dumpJson` failures, `encode`, `toQuads/fromQuads` boundaries, `subschemaAt` errors, static-counterpart failures, computed/invariant lifecycle.

**Targets:** 40,757 LOC → ~16,000 LOC (60% reduction). ~2,178 assertions → ~3,000 assertions (parameterization adds rows). Internal imports: 59 files → ~10 files (only graph internals, projection, format/curie, lift). Files: 82 → ~25.

Bookstore scenario-runner shape (proposed):

```ts
interface ValidationScenario {
  name: string;
  schemas: ReadonlyArray<JsonSchema>; // Book, Author, Order
  data: unknown;
  expectValid: boolean;
  expectedErrors?: ReadonlyArray<{ path: string; keyword: string }>;
}
```

One row per case; one `for (const s of scenarios)` runner per `void describe()`. Every assertion uses literal expected values keyed off `scenario.expected*`.
