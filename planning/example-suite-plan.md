# Example Suite — Single Source of Truth Plan

**Branch:** `docs/example-suite-bookstore` → main once complete.

**Goal.** Every doc page, every example, every benchmark draws from one canonical bookstore domain at `examples/docs/bookstore/`. The bookstore exercises every json-tology surface that consumers need to learn from: structural schemas, OWL class axioms, OWL property characteristics, sameAs identity, invariants, computed fields, and the compile-time enforcement of all of the above.

The bookstore is the *only* source of types, fixtures, and queries that any docs page references. Inline code blocks in markdown are forbidden; every docs example is a `<<<` include from a runnable `.ts` file in `examples/docs/`. Benchmarks measure against the same registered registry.

---

## Current state (audit, 2026-05-16)

| Surface | Count | Status |
|---|---:|---|
| Bookstore entity files | 41 | Some are predicates-in-disguise (SoloAuthored, Anthology) or modelled against the wrong axis (InPrint/OutOfPrint conflated with `inStock` instead of `printStatus`) |
| Bookstore primitives | 18 | Missing `PrintStatus` |
| Bookstore axioms (Compose / restrictions / property characteristics / sameAs) | 9+ | Real; well-exercised but partially wrong (see above) |
| Bookstore invariants (`addInvariant`) | 1 | Order.total = Σ items × unitPrice — already added |
| Bookstore computed fields (`addComputed`) | 0 | None yet — needs adding |
| Example files in `examples/docs/` | 85 | Uneven coverage; some scopes have 1 file, validation has 23 |
| Benchmark files | 17 | All use synthetic `fixtures.ts`, none reach the bookstore registry |
| User-facing docs pages | 67 | 3 use `<<<` includes (bookstore-domain, benchmarks, composition/sub-class-of); ~64 still have inline code |
| `test/types/` compile-time tests | 23 | Most cover core type machinery, not bookstore-axiom enforcement |

**Inconsistencies that must be fixed before the docs sweep.**

1. **`InPrintBook` / `OutOfPrintBook` model the wrong axis.** They use `Compose.hasValue(inStock, true)`. Inventory state (`inStock`) is operational and changes daily; publisher state (`inPrint` vs `outOfPrint`) is editorial and changes rarely. A book can be `inStock: true` and `outOfPrint: true` simultaneously (we have leftover copies; publisher discontinued). They are tangential, edge-connected concepts.
2. **`SoloAuthoredBook` / `AnthologyBook` are predicates, not types.** They add zero structure to Book — only constrain `authors` cardinality. The proper TypeScript way to express "this book has one author" is a length-1 tuple type narrowing, not a separate registered schema. They exist only as Compose-builder demos.
3. **Fixture drift caught and fixed**: field names now match real schemas (`items` not `lines`, `bookIsbn` not `isbn`, etc.); UUIDs are valid hex with valid RFC 4122 variant nibbles; `stockLevel` is a multiple of 5.
4. **No computed fields registered** on production schemas. `addComputed` is documented in `examples/docs/computed/01-add-computed.ts` against a separate `ComputedOrderSchema` rather than the real `OrderSchema`.

---

## Target architecture

### Bookstore — the canonical domain

#### Real domain types (registered schemas)

These have distinct structure, distinct OWL class identity, or both.

| Schema | Why it's a real type |
|---|---|
| `Book` | Root domain entity |
| `EBook` | Adds `fileFormat`, `downloadUrl`, `fileSizeBytes`; structurally distinct |
| `PrintBook` | Adds `binding`, `pageCount`, `weightGrams`; `disjointWith(EBook)` |
| `RareBook` | Adds `firstEditionYear`, `estimatedAgeYears`; restrictions on `authors`; subClassOf PrintBook |
| `SignedFirstEdition` | Adds `signedBy`, `provenance`; subClassOf RareBook + invariant `authors.length === 1` |
| `InPrintBook` | `subClassOf(Book) + hasValue(printStatus, 'inPrint')` — real publishing-state category |
| `OutOfPrintBook` | `complementOf(InPrintBook)` bounded to Book — real publishing-state category |
| `Customer`, `Order`, `OrderLine`, `Review` | Distinct domain entities |
| `Address`, `Money`, `BookAnnotations`, `BookCatalogEntry`, `BookListPage`, `BookRatingHistogram` | Distinct composite entities |
| `Sequel`, `SimilarBook` | Property-characteristic demos (`asymmetric`, `symmetric` on Book → Book relations) |
| All 19 primitives (`Isbn`, `Email`, `Iso8601`, `PrintStatus` NEW, etc.) | Single-source primitives |

#### Removed from the registry (invariants instead)

| Old schema | New form |
|---|---|
| `SoloAuthoredBookSchema` | Registered invariant `signedFirstEditionIsSoloAuthored` on `SignedFirstEditionSchema` — fires through the same `ValidationErrors` collection as structural errors, with `keyword: 'jt:invariant'`. |
| `AnthologyBookSchema` | If a domain need for it surfaces, add a registered invariant on the specific schema that requires multi-author composition; do not introduce a separate OWL class for a pure cardinality predicate. |

Single-authorship adds no structural fields and earns no distinct OWL class identity — but it is still a json-tology axiom, expressed through `addInvariant`. The `Compose.cardinality / minCardinality / allValuesFrom` builder surfaces are demonstrated in `examples/docs/composition/restrictions.ts` against canonical bookstore schemas — e.g. the same `Book.authors` property the `signedFirstEditionIsSoloAuthored` invariant constrains. If a surface needs a property the canonical schemas don't carry, *extend the canonical bookstore* to add it; never invent a one-off synthetic schema for a docs example.

#### New primitive: `PrintStatusSchema`

```ts
{
  $id: 'urn:bookstore:PrintStatus',
  type: 'string',
  enum: ['inPrint', 'outOfPrint', 'limitedRun']
}
```

`Book.printStatus` becomes a required field. `InPrintBook` / `OutOfPrintBook` discriminate on this primitive, not on `inStock`.

#### Production-grade invariants on real schemas

| Invariant | Schema | Rule |
|---|---|---|
| `orderTotalMatchesItems` | Order | `total.amount === Σ items[i].unitPrice.amount × items[i].quantity` |
| `signedFirstEditionIsSoloAuthored` | SignedFirstEdition | `authors.length === 1` |
| `reviewBodyMentionsTitle` | Review | weak: `body.toLowerCase().includes(referencedBook.title.toLowerCase())` — illustrative only |
| `orderPlacedAfterPublication` | Order (per item) | `placedAt > book[i].publishedOn` — joining via the registry |

Invariants surface as `{ keyword: 'jt:invariant', message, params: { invariant: name }, path: pointer }` in `ValidationErrors` — same shape as structural errors.

#### Computed fields

The canonical Customer / Order / Book schemas do not declare any
`jt:computed: true` properties — a `jt:computed` marker forces every
consumer of that schema to register the matching compute function or
the registry refuses to load.

`addComputed` is demonstrated against the canonical `OrderSchema` in
`examples/docs/computed/01-add-computed.ts`: the example calls
`bookstoreEntities.addComputed(OrderSchema.$id, 'subtotal', fn)`,
materializes the canonical Bastian-orders-Neverending-Story fixture, and reads the
new `subtotal` field off the result. `removeComputed` then deregisters
the fn; the next materialization no longer carries `subtotal`. The
materializer always invokes registered compute fns, even for property
names that the schema does not declare — `addComputed` is the runtime
augmentation surface, not a schema declaration.

This pattern keeps the canonical bookstore free of mandatory
computed-field commitments while still demonstrating the surface
against the real registered schemas and fixtures.

#### ABox: the Bastian-orders-Neverending-Story scenario

Single coherent narrative threaded through every example:

- **Customer** Bastian Balthazar Bux — `urn:bookstore:customer:bastian-bux` ↔ `urn:coreander-antiquariat:cust-00042` (sameAs migration)
- **Order** #09f8e7d6-... placed 2026-04-12, ships to Bastian's home address
- **OrderLine** (1×) for the rare book at $12,500
- **RareBook** Michael Ende's *Die unendliche Geschichte* (Thienemann Verlag 1979) — `urn:bookstore:rarebook:neverending-1979-thienemann` ↔ `http://www.worldcat.org/oclc/5705614` (sameAs cross-catalog)
- **Review** Bastian's 5-star review

This data lives in `examples/docs/bookstore/aboxFixtures.ts` (split out from `index.ts` for clarity). Validation against the real schemas is enforced by `test/smoke/bookstoreFixtures.test.ts`.

---

### Compile-time enforcement of axioms

Every axiom registered at runtime must have a corresponding compile-time assertion in `test/types/bookstore-axioms.test.ts`. This is what puts json-tology ahead of pure runtime validators.

| Axiom | Runtime enforcement | Compile-time assertion |
|---|---|---|
| `PrintBook disjointWith EBook` | `validate(PrintBookSchema, ebookValue)` fails | `AssertEqualType<PrintBook & EBook, never>` |
| `OutOfPrintBook complementOf InPrintBook` | runtime `not: { $ref: InPrint }` | `AssertEqualType<InPrintBook & OutOfPrintBook, never>` |
| `RareBook authors maxCardinality 1` | runtime tuple-length check | `RareBook['authors']` is `readonly [string]` (single-element tuple) |
| `SignedFirstEdition: authors.length === 1` (invariant) | `validate()` fails | `SignedFirstEdition['authors']` is `readonly [AuthorName]` |
| `Customer.id inverseFunctional` | sameAs reasoner behavior | `Customer['id']` brand carries `InverseFunctionalBrand<...>` |
| `Order.placedAt transitive + irreflexive` | OWL projection emits the property characteristic | Brand types on `Order['placedAt']` |
| `Compose.cardinality(authors, N)` | runtime check | inferred tuple of length N |

The test/types files use `AssertEqualType<L, R>` (existing utility) to make the compile failure explicit if any axiom drifts from its type-level encoding.

---

### Example directory layout

```
examples/docs/
├── bookstore/                 # THE ONE SOURCE OF TRUTH
│   ├── index.ts              # Registry construction + sameAs + invariants + computed
│   ├── aboxFixtures.ts       # Concrete instance data (the Bastian-orders-Neverending-Story scenario)
│   ├── predicates.ts         # isSoloAuthored, isAnthology, hasStock + type guards
│   ├── antiPatterns.ts       # Intentionally broken values for negative-case demos
│   └── entities/             # One file per schema; single source per entity
├── getting-started/          # The introductory tour
├── schemas/                  # Schema authoring patterns
├── validation/               # instantiate / validate / is / errors / subschemaAt
├── value/                    # Operations.clone / Operations.patch / Hash.value / diff / create
├── transforms/               # Transform.create / brand / chain
├── serialization/            # dump / dumpJson / toSchema
├── composition/              # extend / pick / omit / partial / required / intersection /
│                             # discriminatedUnion / equivalent / subClassOf / restrictions
├── registry/                 # set / has / get / delete / revision / find-duplicates
├── materialization/          # materialize() (less strict than instantiate)
├── computed/                 # addComputed / removeComputed
├── invariants/               # addInvariant / removeInvariant
├── errors/                   # ValidationErrors / aggregate / report / classes
├── advanced/
│   ├── graph-concepts.ts     # TBox / ABox walk
│   ├── graph-internals.ts    # SchemaGraph queries
│   ├── ontology.ts           # toTbox / toShacl / ontology()
│   ├── quads.ts              # toQuads / fromQuads round trips on aboxFixtures
│   ├── sameas.ts             # The two sameAs pairs in action
│   ├── skolemization.ts      # Blank-node IRI generation
│   ├── sub-schemas.ts        # $ref / $defs / anchors
│   ├── federation.ts         # Two registries cross-referencing each other
│   ├── strict-graph-mode.ts  # Frozen registry post-create
│   ├── owl-property-characteristics.ts  # functional, inverseFunctional, transitive, etc.
│   └── utilities.ts          # Curie, Path, Resolver
├── types/                    # InferType / utility / ranges — TS type-level demos
├── usage-examples/           # End-to-end recipes (transform pipelines, class hydration, etc.)
└── benchmarks/               # See "Benchmarks" below
```

#### File naming

`<verb>-<scenario>.ts` for each example:

- `validation/instantiate-customer-with-defaults.ts`
- `validation/instantiate-order-nested-coerce.ts`
- `value/clone-deep-customer.ts`
- `value/diff-order-lines.ts`
- `composition/subClassOf-single-parent.ts` (already done — `EBook.ts` does double duty)
- `composition/cardinality-rare-book.ts` (was SoloAuthored — moves here as a builder demo)
- `invariants/order-total-matches-items.ts` (the real registered invariant)
- `computed/order-item-count.ts`

Each file:
1. Imports only from `../bookstore/index.js` (no synthetic schemas — if a scenario needs unusual structure, propose adding it to the bookstore)
2. Demonstrates exactly one API surface
3. Is runnable with `npx tsx <file>` and prints verifiable output via `console.assert`
4. Has a top-of-file docstring describing what it demonstrates and which docs page it backs
5. Lives behind a `<<< @/../examples/docs/...` include in the docs page

---

### Benchmark migration

`examples/docs/benchmarks/fixtures.ts` currently builds 4 synthetic schemas (`SimpleSchema`, `NestedSchema`, `Customer`, `AddressSchema`, `OrderItemSchema`) and feeds them to every bench. This must change.

New `benchmarks/fixtures.ts`:
- Re-exports the bookstore schemas being benched (`BookSchema`, `OrderSchema`, `RareBookSchema`, `CustomerSchema`, `ReviewSchema`)
- Provides `bench`-shaped instance values derived from `aboxFixtures` — same data the docs reference
- Provides the comparator equivalents (zod, typebox, valibot, io-ts variants of the same schemas)

Each `.bench.ts`:
- `validate.bench.ts` — validates `aboxFixtures.customer`, `aboxFixtures.order`, `aboxFixtures.rareBook` against their bookstore schemas
- `instantiate.bench.ts` — same fixtures through `instantiate()`
- `coerce.bench.ts` — same fixtures through coerce
- `serialize.bench.ts` — dumps `aboxFixtures.order` through json-tology vs `JSON.stringify`
- `compose.bench.ts` — already refactored (use bookstore schemas)
- `transform.bench.ts` — Iso8601 decode/encode round trip on `aboxFixtures.order.placedAt`
- `registry.bench.ts` — cold registration of the bookstore vs warm `validate()`
- `compiled.bench.ts` — compiled vs interpreted on `OrderSchema`

`bench:report` output stays the same shape; only the schemas being measured change. Comparator schemas (zod/typebox/etc.) restructure to match bookstore shape exactly.

---

### Migration phases

Each phase ends with `npm run test:all` + `npm run lint` + `npm run docs:build` + `npm run bench:report` all green and one conventional commit.

**Phase 1 — Bookstore restructure** (current branch state work)
1. Add `PrintStatusSchema` primitive
2. Add `Book.printStatus` (required)
3. Rewrite `InPrintBookSchema` to use `hasValue(printStatus, 'inPrint')`
4. Drop `SoloAuthoredBookSchema`, `AnthologyBookSchema` from registry (delete the files)
5. Simplify `SignedFirstEdition` to single-parent `subClassOf(RareBook)` + invariant on `authors.length === 1`
6. Register the `signedFirstEditionIsSoloAuthored` invariant in `index.ts` against `SignedFirstEditionSchema`
7. Add `examples/docs/bookstore/aboxFixtures.ts` (split out from `index.ts`)
8. Update `aboxFixtures.rareBook` to include `printStatus: 'outOfPrint'`
9. Add registered invariants on Order and SignedFirstEdition
10. Rewrite `examples/docs/computed/01-add-computed.ts` to use a dedicated
    `ComputedOrderSchema` (computed kept off the canonical Customer/Order)
11. `test/smoke/bookstoreFixtures.test.ts` — runtime verification
12. `test/types/bookstore-axioms.test.ts` — compile-time axiom assertions

**Phase 2 — Example file build-out**
- Wave 2A: validation/, value/, errors/
- Wave 2B: composition/, transforms/, serialization/
- Wave 2C: registry/, materialization/, computed/, invariants/
- Wave 2D: advanced/, types/, schemas/, usage-examples/
- Wave 2E: getting-started/, picking-a-method/, argument-conventions/

Each wave creates the missing `.ts` files; smoke test (`docExamples.test.ts`) automatically picks them up.

**Phase 3 — Docs conversion**
Each doc page replaces inline `\`\`\`ts` blocks with `<<<` includes pointing at the phase-2 example files. Comparison-block code (zod/valibot/etc.) stays inline since it's not json-tology code.

**Phase 4 — Benchmark migration**
Rewrite `fixtures.ts` and each `.bench.ts` to use bookstore. Verify bench numbers in the same shape.

**Phase 5 — Lock-in**
- CI gate: lint rule rejecting `\`\`\`ts` blocks in `docs/**/*.md` (except comparison code-groups). New docs pages must use `<<<`.
- ARCHITECTURE.md updated with the example-suite contract.
- CHANGELOG entry for the docs reorg (no API change, but a major doc rework).

---

### Acceptance criteria

A page / example / benchmark / test counts as done when:

- Every TypeScript code block in the user-facing docs originates from a runnable file in `examples/docs/`
- Every schema referenced is exported by `examples/docs/bookstore/`
- Every fixture is from `aboxFixtures` (or extends it via `Compose` / clone, not by inventing new data)
- Every axiom that has a runtime form also has a compile-time `AssertEqualType` assertion in `test/types/`
- `test/smoke/docExamples.test.ts` imports the file without throwing
- The bench numbers reflect the bookstore schemas
- `npm run test:all && npm run lint && npm run docs:build && npm run bench:report` all green

---

## What this delivers

A docs site where a reader can:
1. Open `bookstore-domain.md`, see the entire example domain
2. Click any docs page (validation, transforms, serialization, etc.) and see code that references the same Customer / Order / RareBook they read about on page 1
3. Trust that the example actually runs (smoke test imports it)
4. Trust that the type-level claims are real (compile-time test asserts them)
5. Compare the bench numbers against the same schemas they just learned

For json-tology this means the bookstore is a real example application, not a marketing prop. The fact that invariants + axioms work at both compile-time and runtime — and that one domain demonstrates the full surface — is the differentiator.
