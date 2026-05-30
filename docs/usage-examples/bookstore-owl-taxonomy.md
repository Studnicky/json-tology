---
title: Bookstore OWL taxonomy
---

# Bookstore OWL taxonomy

This page extends the bookstore domain with OWL-style class taxonomy - subClassOf, disjointWith, and registration patterns for the book hierarchy. Prerequisite: [Bookstore domain](/bookstore-domain) and [Graph concepts](/advanced/graph-concepts).

## Book taxonomy and OWL axioms

Beyond the structural entities, the bookstore registry carries seven additional schemas plus two ABox identity assertions that together exercise every `Compose` class-axiom, every OWL restriction the library supports, and the runtime `sameAs` surface. These are the declarations that drive the live `BookstoreGraph` visualization shown on [Your Types Are a Graph](/your-types-are-a-graph) and the home page.

| Schema or axiom | Surface used | Edge / effect in graph |
|---|---|---|
| `EBookSchema`         | `Compose.subClassOf(Book)`                                                                   | `subClassOf` → Book |
| `PrintBookSchema`     | `Compose.subClassOf(Book)` + `Compose.disjointWith(EBook)`                                    | `subClassOf` → Book, `disjointWith` ↔ EBook |
| `RareBookSchema`      | `Compose.subClassOf(PrintBook)` + `Compose.someValuesFrom` + `Compose.maxCardinality`         | `subClassOf` → PrintBook, two `restriction` edges |
| `SignedFirstEditionSchema` | `Compose.subClassOf(RareBook)` + registered `signedFirstEditionIsSoloAuthored` invariant | `subClassOf` → RareBook (the cardinality axiom lives off-graph as an invariant) |
| `InPrintBookSchema`   | `Compose.subClassOf(Book)` + `Compose.hasValue(printStatus, 'inPrint')`                       | `subClassOf` → Book, `restriction` on `printStatus` |
| `OutOfPrintBookSchema`| `Compose.complementOf(InPrintBook)` with body `allOf` bounding to Book                        | `subClassOf` → Book, `complementOf` → InPrintBook |
| `orderTotalMatchesItems` | `bookstoreEntities.addInvariant(OrderSchema, ...)`                                         | runtime cross-field rule on `Order.orderTotal` |
| `signedFirstEditionIsSoloAuthored` | `bookstoreEntities.addInvariant(SignedFirstEditionSchema, ...)`                  | runtime cardinality rule on `SignedFirstEdition.authors` |
| `sameAs(bastian-bux, cust-00042)` | `JsonTology.prototype.sameAs` — customer migration (ABox)                         | `sameAs` between two customer-individual nodes |
| `sameAs(neverending-1979-thienemann, oclc/5705614)` | `JsonTology.prototype.sameAs` — cross-catalog rare-book identity (ABox)    | `sameAs` between two book-individual nodes |

Each `entities/*.ts` file is the single source of truth for one schema.

### `entities/EBook.ts`: `subClassOf`

**In plain English:** an `EBook` is a `Book` with three extra fields (`fileFormat`, `downloadUrl`, `fileSizeBytes`). Validation against `EBookSchema` accepts only values that already validate against `BookSchema` and additionally carry the new fields. Tooling that reads the OWL output (RDF stores, reasoners) sees `EBook` as a kind of `Book`.

**Use this when:**
- You want to derive a new type that adds fields to an existing one.
- You want downstream RDF / OWL consumers to see the parent-child relationship.

**Don't use this when:**
- You want to remove fields - use [`Compose.omit`](/composition/pick-omit).
- You want every field to become optional - use [`Compose.partial`](/composition/partial-required).
- You only want a structural alias (no parent-child semantic) - use [`Compose.equivalent`](/composition/equivalent).

<<< ../../examples/docs/usage-examples/28-bookstore-ebook-subclass.ts

→ See: [`Compose.subClassOf` reference](/composition/sub-class-of) · [`Compose.extend`](/composition/extend) (property-merge alternative) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `entities/PrintBook.ts`: `subClassOf` + `disjointWith`

**In plain English:** a `PrintBook` is a physical-format `Book` with binding, page count, and weight. The `disjointWith` declaration asserts that no single value can be both a `PrintBook` and an `EBook` at the same time - they are mutually exclusive formats. `JsonTology.validate(PrintBookSchema, value)` enforces the constraint at runtime: after a value passes `PrintBook`'s structural check, the registry runs `EBookSchema` against it; if both succeed it surfaces a `disjointWith` violation. Reasoners and OWL-aware query engines see the same assertion in the TBox.

**Use this when:**
- Two classes are siblings under a parent and a single individual cannot belong to both at once (hardcover vs ebook, fiction vs non-fiction in your domain rules, etc.).

**Don't use this when:**
- The two classes overlap intentionally - use plain `Compose.subClassOf` for both without `disjointWith`.
- You want one class to be the negation of another - use [`Compose.complementOf`](/composition/sub-class-of) instead.

<<< ../../examples/docs/usage-examples/29-bookstore-printbook-disjoint.ts

→ See: [`Compose.disjointWith` reference](/composition/sub-class-of) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `entities/RareBook.ts`: `someValuesFrom` + `maxCardinality`

**In plain English:** a `RareBook` is a `PrintBook` with two extra rules about its `authors` array. `someValuesFrom(authors, AuthorName)` asserts that at least one value in the array is an `AuthorName` (rather than some other type). `maxCardinality(authors, 1)` says there is at most one author. Together: a rare book has exactly the right kind of author and never more than one. These are TBox (schema-level) rules; the reasoner uses them to derive facts and find contradictions, while JSON Schema validation handles structural checks.

**Use this when:**
- You want to express "at least one value of property P is of class C" - that's `Compose.someValuesFrom`.
- You want to cap how many values a property can have - that's `Compose.maxCardinality`.

**Don't use this when:**
- You only want to enforce array length at validation time - JSON Schema's native `minItems` / `maxItems` already cover that. Restrictions are for TBox semantic content that reasoners read.
- You want to require *every* value to satisfy a class - use [`Compose.allValuesFrom`](/composition/restrictions) (see `AnthologyBook` below).

<<< ../../examples/docs/usage-examples/30-bookstore-rarebook-restrictions.ts

→ See: [OWL class restrictions](/composition/restrictions) · [`Compose.subClassOf` reference](/composition/sub-class-of) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `entities/SignedFirstEdition.ts` + invariant: subclass with a cross-field axiom

**In plain English:** a `SignedFirstEdition` is a `RareBook` (it inherits every RareBook restriction) plus two new fields, `signedBy` and `provenance`. The "exactly one author" rule isn't a structural shape — it's a relation between two properties — so it's registered as an invariant on the schema, not encoded as a separate OWL class. Invariants surface in `ValidationErrors` with `keyword: 'jt:invariant'`, in the same collection as structural errors.

**Use this when:**
- Your subclass adds fields *and* a cross-field rule. The `subClassOf` declaration carries the OWL TBox; the invariant carries the rule that has no structural form.
- Pairing one schema's structure with a cardinality rule that doesn't earn its own OWL class identity (single-authorship is a fact about the `authors` array, not a separate `Kind`).

**Don't use this when:**
- The constraint *is* structural — use `minItems`/`maxItems` on the array directly.
- The constraint is fixing a property to a literal value — use `Compose.hasValue` (an OWL class axiom).

<<< ../../examples/docs/usage-examples/31-bookstore-signed-first-edition-invariant.ts

The pair encodes the full domain rule: the OWL TBox sees a clean `rdfs:subClassOf RareBook` triple, and `validate()` rejects any candidate `SignedFirstEdition` that fails the cross-field check.

→ See: [`addInvariant` reference](/registry/invariants) · [`Compose.subClassOf` reference](/composition/sub-class-of) · [OWL class restrictions](/composition/restrictions)

### `entities/InPrintBook.ts`: `hasValue` on `printStatus`

**In plain English:** an `InPrintBook` is a `Book` whose `printStatus` property is fixed to the literal `'inPrint'`. `Compose.hasValue(prop, literal)` pins a property to a specific scalar (string, number, or boolean). It's the TBox way of saying "every member of this class has property X equal to value Y".

`printStatus` is the publisher-state primitive (`'inPrint' | 'outOfPrint' | 'limitedRun'`) — editorial state that changes rarely. Inventory state (`inStock`) is orthogonal and daily-mutable, so the InPrint/OutOfPrint axis discriminates on `printStatus`, not `inStock`.

**Use this when:**
- You want a class defined by a fixed scalar value on a property (status flag, fixed currency code, role enum value).

**Don't use this when:**
- The fixed value is a class instance - use `Compose.someValuesFrom` or `Compose.allValuesFrom` (those work with class IRIs, not literals).
- The constraint should only apply at runtime - JSON Schema's native `const` keyword is simpler.

<<< ../../examples/docs/usage-examples/32-bookstore-inprint-hasvalue.ts

→ See: [OWL class restrictions](/composition/restrictions) · [`Compose.subClassOf` reference](/composition/sub-class-of)

### `entities/OutOfPrintBook.ts`: `complementOf` bounded to Book

**In plain English:** an `OutOfPrintBook` is the negation of an `InPrintBook`, but only within the world of `Book`s. The `Compose.complementOf` declaration says "this class is everything that is not the other class". The body's `allOf: [{ $ref: Book }]` adds the structural rule "and it must also be a Book" so the complement is bounded - without it, OWL's open-world rules would match anything that isn't an `InPrintBook`, including a customer or an order.

**Use this when:**
- Two classes naturally tile a parent's universe and you want one defined as "the rest" (banned vs. approved books, returnable vs. non-returnable items, etc.). Combine `complementOf` with `subClassOf`/`allOf` to bound the universe explicitly.

**Don't use this when:**
- You want the unbounded OWL complement (every non-X in the universe). Pass the body without `allOf` and document the open-world semantic clearly.
- You want a runtime "not these specific values" check - JSON Schema's `not` at the top level (without OWL annotations) is simpler.

<<< ../../examples/docs/usage-examples/33-bookstore-outofprint-complement.ts

The body's `allOf: [{ $ref: Book }]` is what bounds the OWL complement to the Book universe. Without it, OWL's open-world `complementOf` would match anything that is not an `InPrintBook`: including non-books - which is the right OWL semantic but rarely what authors want.

→ See: [`Compose.complementOf` reference](/composition/sub-class-of) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `index.ts`: ABox identity — a customer who ordered a rare book

All the schemas above are TBox declarations — they describe *kinds of thing*. `sameAs` is different: it operates on individuals (concrete records, the ABox), and asserts "these two IRIs name the same person/object/thing". The bookstore demonstrates two such assertions tied to one coherent narrative.

**The scenario.** Customer Bastian Balthazar Bux placed an order on 2026-04-12 containing a single line item: a rare first edition of Michael Ende's *Die unendliche Geschichte* (Thienemann Verlag, Stuttgart, 1979, ISBN-13 9783522128001). Two identity assertions register against this scenario:

1. **Customer-CRM migration.** When the bookstore migrated systems in 2024, the legacy CRM record (`urn:coreander-antiquariat:cust-00042`) carried over alongside the new bookstore IRI. Both still resolve to the same person, so `sameAs` lets a reasoner merge purchase history from both sources.
2. **Cross-catalog rare-book identity.** The 1965 Chilton first edition is also catalogued by WorldCat under OCLC `463127`. Declaring `sameAs` unifies bibliographic facts (publisher, page count, condition notes) regardless of which authority emitted them.

**Use this when:**
- Two IRIs in your data refer to the same real-world entity (records merged after a migration, alias systems, cross-org identifiers).

**Don't use this when:**
- You want class-level identity (two *classes* that have the same instances) — use [`Compose.equivalent`](/composition/equivalent) instead. `sameAs` is for individuals, not classes.
- You want to express "these two records *should* be merged" as a workflow step. `sameAs` is an OWL *assertion* that they already refer to one entity; downstream reasoners will treat their property values as belonging to a single individual.

<<< ../../examples/docs/usage-examples/34-bookstore-sameas-identity.ts

The order Bastian placed, the customer record, the rare-book metadata, and their later review are all defined as runtime values on the `aboxFixtures` export. `instantiate()` and `toQuads()` accept those fixtures directly so the same scenario can be used end-to-end across docs pages and integration tests.

<<< ../../examples/docs/usage-examples/35-bookstore-abox-fixtures.ts

→ See: [`sameAs` (ABox identity) reference](/advanced/sameas) · [`Compose.equivalent`](/composition/equivalent) (the class-level counterpart) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

## Edge styles in the live graph

| Edge `kind` | Visual | Source |
|---|---|---|
| `subClassOf`       | solid gray with arrow         | `Compose.subClassOf` (single or multi-parent) |
| `equivalentClass`  | green dashed                  | `Compose.equivalent` |
| `disjointWith`     | red dashed                    | `Compose.disjointWith` |
| `complementOf`     | purple with tee terminator    | `Compose.complementOf` |
| `restriction`      | teal dotted, label = `prop ∃` / `∀` / `card =N` / `card ≥N` / `card ≤N` / `prop = literal` | user-authored `jt:restrictions` (any of the six factory methods) |
| `sameAs`           | gold dashed (symmetric)       | `JsonTology.prototype.sameAs` |
| `range`            | blue with vee arrow           | property `$ref` / `items.$ref` |

See:
- [`Compose.subClassOf` / `disjointWith` / `complementOf`](/composition/sub-class-of)
- [OWL class restrictions](/composition/restrictions)
- [`sameAs` (ABox identity)](/advanced/sameas)

## See also

- [Bookstore domain](/bookstore-domain) - the base schema definitions this taxonomy extends
- [Graph concepts](/advanced/graph-concepts) - TBox/ABox, OWL semantics, and graph-native authoring
