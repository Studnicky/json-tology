# The Bookstore Domain

Every example throughout this documentation uses a single running domain - an eCommerce bookstore. This page defines the folder structure and the schemas that appear in all subsequent guides. Later guides build on this foundation, and examples reference these types by name without re-defining them.

## Why a shared domain

Reading scattered docs is hard when every page introduces fresh data types. By anchoring everything to one domain you can see how concepts compose - `instantiate` in the Validation guide operates on the same `Customer` you defined here; `extend` in Composition derives `CustomerWithDiscount` from that same `Customer`; `dump` in Serialization serializes the order produced by Coercion.

## Folder layout

```
examples/docs/bookstore/
├── index.ts                      # JsonTology.create + re-exports
└── entities/
    ├── AuthorName.ts             # primitive: string, minLength 1
    ├── CityName.ts               # primitive: string, 1-100 chars
    ├── CountryCode.ts            # primitive: string, pattern ^[A-Z]{2}$
    ├── CurrencyCode.ts           # primitive: string, enum of 6 codes
    ├── CustomerId.ts             # primitive: string, format uuid
    ├── Email.ts                  # primitive: string, format email
    ├── Isbn.ts                   # primitive: string, pattern ^\d{13}$
    ├── Iso8601.ts                # primitive: string, format date-time
    ├── Money.ts                  # primitive: number, minimum 0
    ├── OrderId.ts                # primitive: string, format uuid
    ├── PersonName.ts             # primitive: string, 1-200 chars
    ├── PostalCode.ts             # primitive: string, 3-12 chars
    ├── Quantity.ts               # primitive: integer, minimum 1
    ├── RatingScore.ts            # primitive: integer, 1-5
    ├── ReviewId.ts               # primitive: string, format uuid
    ├── StreetLine.ts             # primitive: string, 1-200 chars
    ├── Title.ts                  # primitive: string, 1-500 chars
    ├── Address.ts                # entity: composes StreetLine + CityName + PostalCode + CountryCode
    ├── Book.ts                   # entity: composes Isbn + Title + AuthorName + Money + CurrencyCode
    ├── Customer.ts               # entity: composes CustomerId + Email + PersonName + Address
    ├── OrderLine.ts              # entity: composes Isbn + Quantity + Money
    ├── Order.ts                  # entity: composes OrderId + CustomerId + OrderLine + Money + ...
    ├── Review.ts                 # entity: composes ReviewId + Isbn + CustomerId + RatingScore + ...
    ├── EBook.ts                  # subClassOf Book — digital format
    ├── PrintBook.ts              # subClassOf Book + disjointWith EBook — physical format
    ├── RareBook.ts               # subClassOf PrintBook + OWL property restrictions
    ├── PromotionalBook.ts        # subClassOf Book — currently on promotion
    └── NonPromotionalBook.ts     # complementOf PromotionalBook — defined by negation
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

### CustomerId / OrderId / ReviewId

```ts
// entities/CustomerId.ts
import { CustomerIdSchema } from './entities/CustomerId.js';

export const CustomerIdSchema = {
  $id: 'urn:bookstore:CustomerId',
  type: 'string',
  format: 'uuid',
} as const;
```

### Email

```ts
// entities/Email.ts
export const EmailSchema = {
  $id: 'urn:bookstore:Email',
  type: 'string',
  format: 'email',
} as const;
```

### Money

```ts
// entities/Money.ts
export const MoneySchema = {
  $id: 'urn:bookstore:Money',
  type: 'number',
  minimum: 0,
} as const;
```

## Entities (composed of named primitives)

### Address

```ts
// entities/Address.ts
import { CityNameSchema } from './CityName.js';
import { CountryCodeSchema } from './CountryCode.js';
import { PostalCodeSchema } from './PostalCode.js';
import { StreetLineSchema } from './StreetLine.js';

export const AddressSchema = {
  $id: 'urn:bookstore:Address',
  type: 'object',
  properties: {
    street:     { $ref: StreetLineSchema.$id },
    city:       { $ref: CityNameSchema.$id },
    postalCode: { $ref: PostalCodeSchema.$id },
    country:    { $ref: CountryCodeSchema.$id },
  },
  required: ['street', 'city', 'postalCode'],
} as const;
```

### Customer

```ts
// entities/Customer.ts
import { CustomerIdSchema } from './CustomerId.js';
import { EmailSchema } from './Email.js';
import { PersonNameSchema } from './PersonName.js';
// see entities/Address.ts for AddressSchema
export const CustomerSchema = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:        { $ref: CustomerIdSchema.$id },
    email:     { $ref: EmailSchema.$id },
    name:      { $ref: PersonNameSchema.$id },
    addresses: {
      type: 'array',
      items: { $ref: AddressSchema.$id },
      default: [],
    },
  },
  required: ['id', 'email', 'name'],
} as const;
```

### Book

```ts
// entities/Book.ts
import { AuthorNameSchema } from './AuthorName.js';
import { CurrencyCodeSchema } from './CurrencyCode.js';
import { IsbnSchema } from './Isbn.js';
import { MoneySchema } from './Money.js';
import { TitleSchema } from './Title.js';

export const BookSchema = {
  $id: 'urn:bookstore:Book',
  type: 'object',
  properties: {
    isbn:     { $ref: IsbnSchema.$id },
    title:    { $ref: TitleSchema.$id },
    authors:  { type: 'array', items: { $ref: AuthorNameSchema.$id }, minItems: 1 },
    price:    { $ref: MoneySchema.$id },
    currency: { $ref: CurrencyCodeSchema.$id, default: 'USD' },
    inStock:  { type: 'boolean', default: true },
  },
  required: ['isbn', 'title', 'authors', 'price', 'currency'],
} as const;
```

### OrderLine

```ts
// entities/OrderLine.ts
import { IsbnSchema } from './Isbn.js';
import { MoneySchema } from './Money.js';
import { QuantitySchema } from './Quantity.js';

export const OrderLineSchema = {
  $id: 'urn:bookstore:OrderLine',
  type: 'object',
  properties: {
    bookIsbn:  { $ref: IsbnSchema.$id },
    quantity:  { $ref: QuantitySchema.$id },
    unitPrice: { $ref: MoneySchema.$id },
  },
  required: ['bookIsbn', 'quantity', 'unitPrice'],
} as const;
```

### Order

```ts
// entities/Order.ts
import { AddressSchema } from './Address.js';
import { CustomerIdSchema } from './CustomerId.js';
import { Iso8601Schema } from './Iso8601.js';
import { MoneySchema } from './Money.js';
import { OrderIdSchema } from './OrderId.js';
import { OrderLineSchema } from './OrderLine.js';

export const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    id:              { $ref: OrderIdSchema.$id },
    customerId:      { $ref: CustomerIdSchema.$id },
    items:           { type: 'array', items: { $ref: OrderLineSchema.$id }, minItems: 1 },
    total:           { $ref: MoneySchema.$id },
    shippingAddress: { $ref: AddressSchema.$id },
    placedAt:        { $ref: Iso8601Schema.$id },
  },
  required: ['id', 'customerId', 'items', 'total', 'placedAt', 'shippingAddress'],
} as const;
```

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

The orchestrator `examples/docs/bookstore/index.ts` creates the shared `jt` instance with all 23 schemas pre-registered. Primitives register first (required by `$ref` resolution):

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

## Book taxonomy and OWL axioms

The bookstore registry includes five entities that demonstrate `Compose`'s OWL class-axiom and restriction surface. They live alongside the primitive entities and are registered together so the live ontology graph (and the `BookstoreGraph` visualization) renders every axiom kind:

```ts
// entities/EBook.ts — Compose.subClassOf produces { $id, allOf: [{ $ref: Book.$id }, body] }
import { Compose } from 'json-tology';
export const EBookSchema = Compose.subClassOf(BookSchema, {
  $id: 'urn:bookstore:EBook',
  type: 'object',
  properties: {
    fileFormat:    { type: 'string', enum: ['epub', 'pdf', 'mobi'] },
    downloadUrl:   { type: 'string', format: 'uri' },
    fileSizeBytes: { type: 'integer', minimum: 0 },
  },
  required: ['fileFormat', 'downloadUrl'],
} as const);
```

```ts
// entities/PrintBook.ts — subClassOf Book + disjointWith EBook
const PrintBookBase = Compose.subClassOf(BookSchema, {
  $id: 'urn:bookstore:PrintBook',
  type: 'object',
  properties: {
    binding:     { type: 'string', enum: ['hardcover', 'paperback'] },
    pageCount:   { type: 'integer', minimum: 1 },
    weightGrams: { type: 'number',  minimum: 0 },
  },
  required: ['binding', 'pageCount'],
} as const);

export const PrintBookSchema = Compose.disjointWith(EBookSchema, PrintBookBase);
// TBox: urn:bookstore:PrintBook owl:disjointWith urn:bookstore:EBook
```

```ts
// entities/RareBook.ts — chained Compose.subClassOf attaches OWL property restrictions
const AUTHORS = 'urn:bookstore:Book#authors';

export const RareBookSchema = Compose.subClassOf(
  Compose.maxCardinality(AUTHORS, 1),
  Compose.subClassOf(
    Compose.someValuesFrom(AUTHORS, AuthorNameSchema.$id),
    Compose.subClassOf(PrintBookSchema, {
      $id: 'urn:bookstore:RareBook',
      type: 'object',
      properties: {
        firstEditionYear:  { type: 'integer', minimum: 1450, maximum: 2100 },
        estimatedAgeYears: { type: 'integer', minimum: 0 },
      },
      required: ['firstEditionYear'],
    } as const),
  ),
);
// TBox: two anonymous owl:Restriction blank nodes attached via rdfs:subClassOf —
//   onProperty Book#authors, owl:someValuesFrom AuthorName
//   onProperty Book#authors, owl:maxCardinality 1
```

```ts
// entities/NonPromotionalBook.ts — Compose.complementOf
export const NonPromotionalBookSchema = Compose.complementOf(PromotionalBookSchema, {
  $id: 'urn:bookstore:NonPromotionalBook',
  type: 'object',
} as const);
// Wire shape: { $id, not: { $ref: 'urn:bookstore:PromotionalBook' }, type: 'object' }
// TBox: urn:bookstore:NonPromotionalBook owl:complementOf urn:bookstore:PromotionalBook
```

```ts
// index.ts — ABox owl:sameAs assertion between two customer IRIs
bookstoreEntities.sameAs(
  'urn:bookstore:customer:c-7af3-21e8',
  'urn:bookstore:customer:legacy-4421',
);
// toQuads() emits both directions:
//   <c-7af3-21e8>     owl:sameAs <legacy-4421>
//   <legacy-4421>     owl:sameAs <c-7af3-21e8>
```

The live graph at the top of [Your Types Are a Graph](/your-types-are-a-graph) renders every one of these axioms with a distinct edge style — `subClassOf` (gray), `disjointWith` (red dashed), `complementOf` (purple with tee terminator), `restriction` (teal dotted), and `sameAs` (gold dashed).

See:
- [`Compose.subClassOf` / `disjointWith` / `complementOf`](/composition/sub-class-of)
- [OWL class restrictions](/composition/restrictions)
- [`sameAs` (ABox identity)](/advanced/sameas)

## Importing in your examples

All subsequent guide pages import from the shared orchestrator:

```ts
import { bookstoreEntities as entities, CustomerSchema } from '../bookstore/index.js';
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
| [Type Inference](/types) | How `InferType<typeof CustomerSchema>` resolves at compile time |
| [Validation](/validation/instantiate) | `validate`, `is`, `errors` - checking incoming data against these schemas |
| [Coercion](/validation/instantiate) | `instantiate` - validated + defaults applied, typed result |
| [Error Views](/errors/views) | `aggregate`, `report` |
| [Composition](/composition/extend) | Derive `CustomerWithDiscount`, `BookSummary`, `PatchOrder` |
| [Value Operations](/value/clone-hash) | `clone`, `hash`, `diff` on a coerced `Order` |
| [Serialization](/serialization/dump) | `dump`, `dumpJson` - serialize an `Order` back to wire form |
| [Ontology](/advanced/ontology) | Advanced: RDF/OWL/SHACL from these schemas |

## Related

- [Schemas](/schemas) - how `register`, `has`, `get` work with these definitions
- [Type Inference](/types) - how `InferType<typeof CustomerSchema>` resolves
- [Validation](/validation/instantiate) - coercing incoming data against these schemas

## See also

- [Graph concepts](/advanced/graph-concepts) - TBox/ABox from these schemas
- [Graph-native authoring](/advanced/graph-native-authoring) - named primitives and `$ref`
