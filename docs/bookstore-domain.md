# The Bookstore Domain

Every example throughout this documentation uses a single running domain — an eCommerce bookstore. This page defines the folder structure and the schemas that appear in all subsequent guides. Later guides build on this foundation, and examples reference these types by name without re-defining them.

> **Source:** the full domain (TBox schemas, ABox seed data, transforms, anti-pattern fixtures) lives at [`examples/docs/bookstore/`](https://github.com/Studnicky/json-tology/tree/main/examples/docs/bookstore). Every code block on this page is excerpted from those files; clone the repo and run them directly.

## Why a shared domain

Reading scattered docs is hard when every page introduces fresh data types. By anchoring everything to one domain you can see how concepts compose - `instantiate` in the Validation guide operates on the same `Customer` you defined here; `extend` in Composition derives `CustomerWithDiscount` from that same `Customer`; `dump` in Serialization serializes the order produced by Coercion.

## Folder layout

```
examples/docs/bookstore/
├── index.ts                      # JsonTology.create + re-exports
└── entities/
    ├── Amount.ts                 # primitive: number, minimum 0
    ├── AuthorName.ts             # primitive: string, minLength 1 (equivalent of PersonName)
    ├── CityName.ts               # primitive: string, 1-100 chars
    ├── CountryCode.ts            # primitive: string, pattern ^[A-Z]{2}$
    ├── CurrencyCode.ts           # primitive: string, enum of 6 codes
    ├── CustomerId.ts             # primitive: string, format uuid
    ├── CustomerName.ts           # primitive: string, equivalent of PersonName in customer context
    ├── Email.ts                  # primitive: string, format email
    ├── Isbn.ts                   # primitive: string, pattern ^\d{13}$
    ├── Iso8601.ts                # primitive: string, format date-time
    ├── Money.ts                  # composite: { amount: Amount, currency: CurrencyCode }
    ├── OrderId.ts                # primitive: string, format uuid
    ├── PersonName.ts             # primitive: string, 1-200 chars
    ├── PostalCode.ts             # primitive: string, 3-12 chars
    ├── Quantity.ts               # primitive: integer, minimum 1
    ├── RatingScore.ts            # primitive: integer, 1-5
    ├── ReviewId.ts               # primitive: string, format uuid
    ├── StreetLine.ts             # primitive: string, 1-200 chars
    ├── Title.ts                  # primitive: string, 1-500 chars
    ├── Address.ts                # entity: composes StreetLine + CityName + PostalCode + CountryCode
    ├── Book.ts                   # entity: composes Isbn + Title + AuthorName + Money + PublicationDate + StockLevel + BookAnnotations + BookRatingHistogram
    ├── Customer.ts               # entity: composes CustomerId + Email + CustomerName + Address
    ├── OrderLine.ts              # entity: composes Isbn + Quantity + Money
    ├── Order.ts                  # entity: composes OrderId + CustomerId + OrderLine + Money + ...
    ├── Review.ts                 # entity: composes ReviewId + Isbn + CustomerId + RatingScore + ...
    ├── EBook.ts                  # subClassOf Book — digital format
    ├── PrintBook.ts              # subClassOf Book + disjointWith EBook — physical format
    ├── RareBook.ts               # subClassOf PrintBook + someValuesFrom + maxCardinality
    ├── SoloAuthoredBook.ts       # subClassOf Book + cardinality(authors, 1)
    ├── AnthologyBook.ts          # subClassOf Book + minCardinality + allValuesFrom
    ├── InPrintBook.ts            # subClassOf Book + hasValue(inStock, true)
    └── OutOfPrintBook.ts         # complementOf InPrintBook, allOf-bounded to Book
```

Each primitive file exports a single schema constant with a stable `$id` using the `urn:bookstore:` IRI pattern. Entity files import only the primitives they reference - every `$ref` is `{ $ref: SourceSchema.$id }` with an explicit named import at the top of the file.

## The IRI pattern

All bookstore schemas use URN-style identifiers:

```
urn:bookstore:{PascalCaseName}
```

Examples: `urn:bookstore:Isbn`, `urn:bookstore:Customer`, `urn:bookstore:Order`.

## Primitives (named, single source of truth)

### Isbn

```ts
// entities/Isbn.ts
export const IsbnSchema = {
  $id: 'urn:bookstore:Isbn',
  type: 'string',
  pattern: '^\\d{13}$',
} as const;
```

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

```ts
// entities/Review.ts
import { CustomerIdSchema } from './CustomerId.js';
import { IsbnSchema } from './Isbn.js';
import { Iso8601Schema } from './Iso8601.js';
import { RatingScoreSchema } from './RatingScore.js';
import { ReviewIdSchema } from './ReviewId.js';

export const ReviewSchema = {
  $id: 'urn:bookstore:Review',
  type: 'object',
  properties: {
    id:         { $ref: ReviewIdSchema.$id },
    bookIsbn:   { $ref: IsbnSchema.$id },
    customerId: { $ref: CustomerIdSchema.$id },
    rating:     { $ref: RatingScoreSchema.$id },
    body:       { type: 'string', minLength: 10 },
    postedAt:   { $ref: Iso8601Schema.$id },
  },
  required: ['id', 'bookIsbn', 'customerId', 'rating', 'body', 'postedAt'],
} as const;
```

## Registering everything at once

The orchestrator `examples/docs/bookstore/index.ts` creates the shared `jt` instance with all 31 schemas pre-registered. Primitives register first (required by `$ref` resolution):

```ts
import { JsonTology } from 'json-tology';
import { AuthorNameSchema } from './entities/AuthorName.js';
import { IsbnSchema } from './entities/Isbn.js';
import { MoneySchema } from './entities/Money.js';
// ... all primitives
import { BookSchema } from './entities/Book.js';
import { CustomerSchema } from './entities/Customer.js';
// ... all entities

export const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    // Primitives first
    AuthorNameSchema, /* ... */
    // Entities after
    AddressSchema, BookSchema, CustomerSchema, OrderLineSchema, OrderSchema, ReviewSchema,
  ] as const,
});

export { IsbnSchema, BookSchema, CustomerSchema /* ... all schemas */ };
```

`as const` is required so TypeScript preserves the literal types needed for `InferType<T>` inference.

## Class taxonomy (advanced)

The bookstore domain extends to an OWL-style class hierarchy with subClassOf and disjointWith axioms. See [Bookstore OWL taxonomy](/usage-examples/bookstore-owl-taxonomy) for the full example.

## Importing in your examples

All subsequent guide pages import from the shared orchestrator:

```ts
import { bookstoreEntities, CustomerSchema } from '../bookstore/index.js';
```

Or import directly from the specific entity file when only one is needed:

```ts
import { IsbnSchema } from '../bookstore/entities/Isbn.js';
```

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
