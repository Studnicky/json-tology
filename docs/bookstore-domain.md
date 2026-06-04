# The Bookstore Domain

Every example throughout this documentation uses a single running domain: an eCommerce bookstore. This page defines the folder structure and the schemas that appear in all subsequent guides. Later guides build on this foundation, and examples reference these types by name without re-defining them.

> **Source:** the full domain (TBox schemas, ABox seed data, transforms, anti-pattern fixtures) lives at [`examples/docs/bookstore/`](https://github.com/Studnicky/json-tology/tree/main/examples/docs/bookstore). Every code block on this page is excerpted from those files; clone the repo and run them directly.

## Why a shared domain

Reading scattered docs is hard when every page introduces fresh data types. By anchoring everything to one domain you can see how concepts compose - `instantiate` in the Validation guide operates on the same `Customer` you defined here; `extend` in Composition derives `CustomerWithDiscount` from that same `Customer`; `dump` in Serialization serializes the order produced by Coercion.

## Folder layout

```
examples/docs/bookstore/
├── index.ts                      # JsonTology.create + re-exports
├── aboxFixtures.ts               # Concrete ABox instance data (Bastian orders the Neverending Story)
├── transforms.ts                 # ETL transform examples
├── antiPatterns.ts               # Patterns the registry rejects (documentation)
└── entities/
    ├── Amount.ts                 # primitive: number, minimum 0
    ├── AuthorName.ts             # primitive: string, minLength 1 (subtype of PersonName)
    ├── BindingType.ts            # primitive: enum hardcover | paperback | spiral | leatherbound
    ├── CityName.ts               # primitive: string, 1-100 chars
    ├── CountryCode.ts            # primitive: string, pattern ^[A-Z]{2}$
    ├── CurrencyCode.ts           # primitive: string, enum of 6 codes
    ├── CustomerId.ts             # primitive: string, format uuid
    ├── CustomerName.ts           # primitive: string, subtype of PersonName
    ├── DownloadUrl.ts            # primitive: string, format uri, x-jt-iriRef: true
    ├── EBookFormat.ts            # primitive: enum epub | pdf | mobi | azw3
    ├── Email.ts                  # primitive: string, format email
    ├── EstimatedAgeYears.ts      # primitive: integer, minimum 0
    ├── FileSizeBytes.ts          # primitive: integer, minimum 0
    ├── FirstEditionYear.ts       # primitive: integer, minimum 1400, maximum 2100
    ├── Isbn.ts                   # primitive: string, pattern ^\d{13}$
    ├── Iso8601.ts                # primitive: string, format date-time
    ├── OrderId.ts                # primitive: string, format uuid
    ├── PageCount.ts              # primitive: integer, minimum 0
    ├── PageNumber.ts             # primitive: integer, minimum 1
    ├── PageSize.ts               # primitive: integer, minimum 1
    ├── PersonName.ts             # primitive: string, 1-200 chars
    ├── PostalCode.ts             # primitive: string, 3-12 chars
    ├── PrintPageCount.ts         # primitive: integer, minimum 1
    ├── PrintStatus.ts            # primitive: enum inPrint | outOfPrint | limitedRun
    ├── Provenance.ts             # primitive: string, x-jt-language: de
    ├── PublicationDate.ts        # primitive: string, format date
    ├── Quantity.ts               # primitive: integer, minimum 1
    ├── RatingCount.ts            # primitive: integer, minimum 0
    ├── RatingScore.ts            # primitive: integer, 1-5
    ├── ReviewBody.ts             # primitive: string, minLength 1
    ├── ReviewId.ts               # primitive: string, format uuid
    ├── StockLevel.ts             # primitive: integer, minimum 0, multipleOf 5
    ├── StreetLine.ts             # primitive: string, 1-200 chars
    ├── Title.ts                  # primitive: string, 1-500 chars
    ├── VerifiedPurchase.ts       # primitive: boolean, default false
    ├── WeightGrams.ts            # primitive: integer, minimum 1
    ├── Money.ts                  # composite: { amount: Amount, currency: CurrencyCode }
    ├── Address.ts                # entity: composes StreetLine + CityName + PostalCode + CountryCode
    ├── BibliographicRecord.ts    # entity: isbn (inverseFunctional) + title + authors + publishedOn
    ├── Book.ts                   # entity: subClassOf BibliographicRecord, adds price + printStatus + inStock + stockLevel + ratings + annotations
    ├── BookAnnotations.ts        # entity: free-text tag array on a book
    ├── BookCatalogEntry.ts       # entity: isbn + variants array (kind + variantPrice)
    ├── BookListPage.ts           # entity: paginated Book results with cursor pagination metadata
    ├── BookRatingHistogram.ts    # entity: histogram of RatingScore → RatingCount
    ├── Customer.ts               # entity: composes CustomerId + Email + CustomerName + Address
    ├── EBook.ts                  # subClassOf Book + disjointWith PrintBook — digital format (epub/pdf/mobi/azw3)
    ├── InPrintBook.ts            # subClassOf Book, hasValue(printStatus, 'inPrint')
    ├── Order.ts                  # entity: composes OrderId + CustomerId + OrderLine[] + Money + shippingAddress
    ├── OrderLine.ts              # entity: composes Isbn + Quantity + Money
    ├── OutOfPrintBook.ts         # complementOf InPrintBook, allOf-bounded to Book
    ├── PrintBook.ts              # subClassOf Book + disjointWith EBook — physical format with binding + pageCount + weightGrams
    ├── RareBook.ts               # subClassOf PrintBook + someValuesFrom(authors) + maxCardinality(authors, 1)
    ├── Review.ts                 # entity: ReviewId + Isbn + CustomerId + RatingScore + ReviewBody + Iso8601 + annotated edge
    ├── Sequel.ts                 # relation: book + predecessor (asymmetric: true)
    ├── SignedFirstEdition.ts     # subClassOf RareBook + Provenance + signedBy + solo-author invariant
    └── SimilarBook.ts            # relation: a + b (symmetric: true, reflexive: true)
```

Cross-field rules that JSON Schema and TypeScript can't express structurally (like "a `SignedFirstEdition` has exactly one author") are registered on the schema as invariants (`bookstoreEntities.addInvariant`). The invariant function runs after structural validation and surfaces failures in the same `ValidationErrors` shape as any structural error, with `keyword: 'jt:invariant'`. This is how json-tology augments TypeScript: schema declarations carry not just shape but the runtime axioms that shape can't express, and the inferred TS type tracks both.

Each primitive file exports a single schema constant with a stable `$id` using the `urn:bookstore:` IRI pattern. Entity files import only the primitives they reference — every `$ref` is `{ $ref: SourceSchema.$id }` with an explicit named import at the top of the file.

## The IRI pattern

All bookstore schemas use URN-style identifiers:

```
urn:bookstore:{PascalCaseName}
```

Examples: `urn:bookstore:Isbn`, `urn:bookstore:Customer`, `urn:bookstore:Order`.

## Primitives (named, single source of truth)

### Isbn

<RunnableExample src="examples/docs/bookstore-domain/01-isbn-primitive" />

### CustomerId

<<< ../examples/docs/bookstore/entities/CustomerId.ts

### Email

<<< ../examples/docs/bookstore/entities/Email.ts

### Money

<<< ../examples/docs/bookstore/entities/Money.ts

## Entities (composed of named primitives)

### Address

<<< ../examples/docs/bookstore/entities/Address.ts

### Customer

<<< ../examples/docs/bookstore/entities/Customer.ts

### Book

<<< ../examples/docs/bookstore/entities/Book.ts

### OrderLine

<<< ../examples/docs/bookstore/entities/OrderLine.ts

### Order

<<< ../examples/docs/bookstore/entities/Order.ts

### Review

<RunnableExample src="examples/docs/bookstore-domain/02-review-schema" />

## Annotated edge: `reviewsBook`

The `Review` entity carries an optional `reviewsBook` property built with `Compose.annotatedEdge`. This is json-tology's RDF 1.2 triple-term pattern: the base triple asserts that a review is about a book, and the annotation quads attach additional facts directly to that triple rather than to the review individual.

The base triple emitted by `toQuads` is:

```
<review-iri> <https://bookstore.example/reviews> <book-iri>
```

Two annotations ride the edge, each with an explicitly grounded predicate IRI via `x-jt-predicate`:

| Annotation | Type | Grounded predicate |
|---|---|---|
| `ratingGiven` | `RatingScore` (integer 1–5) | `https://schema.org/ratingValue` |
| `verifiedPurchase` | `VerifiedPurchase` (boolean) | `https://schema.org/verified` |

The annotation quads in triple-term form are:

```
<< <review-iri> <https://bookstore.example/reviews> <book-iri> >>
    <https://schema.org/ratingValue>  "5"^^xsd:integer .
<< <review-iri> <https://bookstore.example/reviews> <book-iri> >>
    <https://schema.org/verified>  "true"^^xsd:boolean .
```

Without `x-jt-predicate`, each annotation predicate auto-derives from the schema IRI and property path. Grounding to a shared vocabulary (schema.org here) makes the annotation predicates interoperable with any consumer that understands that vocabulary. The `x-jt-predicate` keyword is the same one that pins regular property predicates to external IRIs — it works on annotation sub-schemas in exactly the same way.

<<< ../examples/docs/bookstore/entities/Review.ts

## Registering everything at once

The orchestrator `examples/docs/bookstore/index.ts` creates the shared `jt` instance with all 56 schemas pre-registered. Primitives register first (required by `$ref` resolution):

<RunnableExample src="examples/docs/bookstore-domain/03-registry-orchestrator" />

`as const` is required so TypeScript preserves the literal types needed for `InferType<T>` inference.

## Class taxonomy (advanced)

The bookstore domain extends to an OWL-style class hierarchy with subClassOf and disjointWith axioms. See [Bookstore OWL taxonomy](/usage-examples/bookstore-owl-taxonomy) for the full example.

## Importing in your examples

All subsequent guide pages import from the shared orchestrator:

<RunnableExample src="examples/docs/bookstore-domain/04-import-from-orchestrator" />

Or import directly from the specific entity file when only one is needed:

<RunnableExample src="examples/docs/bookstore-domain/05-import-direct-entity" />

## What comes next

The guides that follow build concepts one at a time, each adding to what came before:

| Guide | What it adds |
|-------|-------------|
| [Schemas](/schemas) | How `register`, `has`, `get`, `list` work with these definitions |
| [Type Inference](/types/infer) | How `InferType<typeof CustomerSchema>` resolves at compile time |
| [Validation](/validation/instantiate) | `validate`, `is`, `errors` - checking incoming data against these schemas |
| [Coercion](/validation/instantiate) | `instantiate` - validated + defaults applied, typed result |
| [Error Views](/errors/views) | `aggregate`, `report` |
| [Composition](/composition/extend) | Derive `CustomerWithDiscount`, `BookSummary`, `PatchOrder` |
| [Value Operations](/value/clone-hash) | `clone`, `hash`, `diff` on a coerced `Order` |
| [Serialization](/serialization/dump) | `dump`, `dumpJson` - serialize an `Order` back to wire form |
| [Ontology](/advanced/ontology) | Advanced: RDF/OWL/SHACL from these schemas |

## Related

- [Schemas](/schemas) - how `register`, `has`, `get` work with these definitions
- [Type Inference](/types/infer) - how `InferType<typeof CustomerSchema>` resolves
- [Validation](/validation/instantiate) - coercing incoming data against these schemas

## See also

- [Graph concepts](/advanced/graph-concepts) - TBox/ABox from these schemas
- [Graph-native authoring](/advanced/graph-native-authoring) - named primitives and `$ref`
