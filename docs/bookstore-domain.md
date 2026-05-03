# The Bookstore Domain

Every example throughout this documentation uses a single running domain — an eCommerce bookstore. This page defines the six schemas that appear in all subsequent guides. Later guides build on this foundation, and examples reference these types by name without re-defining them.

## Why a shared domain

Reading scattered docs is hard when every page introduces fresh data types. By anchoring everything to one domain you can see how concepts compose — `coerce` in the Validation guide operates on the same `Customer` you defined here; `extend` in Composition derives `CustomerWithDiscount` from that same `Customer`; `dump` in Serialization serializes the order produced by Coercion.

## The six schemas

### Address

An Address is a re-usable embedded object. It appears on `Customer` (as `addresses`) and is used as a sub-schema via `$ref`.

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology';

const AddressSchema = {
  $id: 'https://bookstore.example/Address',
  type: 'object',
  properties: {
    street:     { type: 'string' },
    city:       { type: 'string' },
    postalCode: { type: 'string' },
    country:    { type: 'string', default: 'US' },
  },
  required: ['street', 'city', 'postalCode'],
} as const;

type Address = InferType<typeof AddressSchema>;
// {
//   readonly street: string;
//   readonly city: string;
//   readonly postalCode: string;
//   readonly country?: string;
// }
```

### Customer

A Customer has identity fields (`id`, `email`, `name`) and a list of delivery addresses. The `addresses` array defaults to empty so `coerce()` never returns `undefined` for it.

```ts
const CustomerSchema = {
  $id: 'https://bookstore.example/Customer',
  type: 'object',
  properties: {
    id:        { type: 'string', format: 'uuid' },
    email:     { type: 'string', format: 'email' },
    name:      { type: 'string' },
    addresses: {
      type: 'array',
      items: { $ref: 'https://bookstore.example/Address' },
      default: [],
    },
  },
  required: ['id', 'email', 'name'],
} as const;

type Customer = InferType<typeof CustomerSchema>;
```

### Book

A Book is the product being sold. `isbn` is a 13-digit string, `price` must be strictly positive, and `inStock` defaults to `true`.

```ts
const BookSchema = {
  $id: 'https://bookstore.example/Book',
  type: 'object',
  properties: {
    isbn:     { type: 'string', pattern: '^\\d{13}$' },
    title:    { type: 'string' },
    authors:  { type: 'array', items: { type: 'string' }, minItems: 1 },
    price:    { type: 'number', exclusiveMinimum: 0 },
    currency: { type: 'string', default: 'USD' },
    inStock:  { type: 'boolean', default: true },
  },
  required: ['isbn', 'title', 'authors', 'price'],
} as const;

type Book = InferType<typeof BookSchema>;
```

### OrderLine

An OrderLine ties a specific ISBN to a quantity and unit price at time of purchase.

```ts
const OrderLineSchema = {
  $id: 'https://bookstore.example/OrderLine',
  type: 'object',
  properties: {
    bookIsbn:  { type: 'string', pattern: '^\\d{13}$' },
    quantity:  { type: 'integer', minimum: 1 },
    unitPrice: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['bookIsbn', 'quantity', 'unitPrice'],
} as const;

type OrderLine = InferType<typeof OrderLineSchema>;
```

### Order

An Order belongs to a Customer, contains one or more `OrderLine` items, and records the total at time of placement.

```ts
const OrderSchema = {
  $id: 'https://bookstore.example/Order',
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid' },
    items: {
      type: 'array',
      items: { $ref: 'https://bookstore.example/OrderLine' },
      minItems: 1,
    },
    total:    { type: 'number', exclusiveMinimum: 0 },
    currency: { type: 'string', default: 'USD' },
    placedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'customerId', 'items', 'total', 'placedAt'],
} as const;

type Order = InferType<typeof OrderSchema>;
```

### Review

A Review links a Customer to a Book with a 1–5 star rating and a minimum-length body.

```ts
const ReviewSchema = {
  $id: 'https://bookstore.example/Review',
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    bookIsbn:   { type: 'string', pattern: '^\\d{13}$' },
    customerId: { type: 'string', format: 'uuid' },
    rating:     { type: 'integer', minimum: 1, maximum: 5 },
    body:       { type: 'string', minLength: 10 },
    postedAt:   { type: 'string', format: 'date-time' },
  },
  required: ['id', 'bookIsbn', 'customerId', 'rating', 'body', 'postedAt'],
} as const;

type Review = InferType<typeof ReviewSchema>;
```

## Registering everything at once

All subsequent guide pages use a single `jt` instance with all six schemas pre-registered. This is how you set it up in a real application:

```ts
import { JsonTology } from 'json-tology';

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    AddressSchema,
    CustomerSchema,
    BookSchema,
    OrderLineSchema,
    OrderSchema,
    ReviewSchema,
  ] as const,
});
```

`as const` is required so TypeScript preserves the literal types needed for `InferType<T>` inference. The `baseIRI` becomes the base for any ontology output (see the [Ontology and Graphs](/ontology) advanced guide if you need that).

## What comes next

The guides that follow build concepts one at a time, each adding to what came before:

| Guide | What it adds |
|-------|-------------|
| [Schemas](/schemas) | How `register`, `has`, `get`, `list` work with these definitions |
| [Type Inference](/types) | How `InferType<typeof CustomerSchema>` resolves at compile time |
| [Validation](/validation) | `validate`, `is`, `errors` — checking incoming data against these schemas |
| [Coercion](/validation#coerce) | `coerce` — validated + defaults applied, typed result |
| [Error Views](/validation#error-views) | `messages`, `format`, `flatten`, `aggregate`, `report` |
| [Composition](/composition) | Derive `CustomerWithDiscount`, `BookSummary`, `PatchOrder` |
| [Value Operations](/value) | `clone`, `hash`, `diff` on a coerced `Order` |
| [Serialization](/dump) | `dump`, `dumpJson` — serialize an `Order` back to wire form |
| [Ontology](/ontology) | Advanced: RDF/OWL/SHACL from these schemas |
