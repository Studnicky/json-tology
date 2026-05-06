# `Compose.pick` and `Compose.omit`

`pick` and `omit` are inverse operations for creating schema projections. Both return new schema objects - input schemas are never mutated.

---

## `Compose.pick` {#compose-pick}

**Declaration.** Creates a new schema containing only the specified property keys. The `required` array is filtered to include only keys that were in the original `required` and appear in the `keys` argument. Non-picked `required` fields are dropped. TypeScript infers a type with only the picked properties.

**Use this when** you need a schema that exposes only a subset of fields - for API projections, list-view summaries, or public interfaces that should not expose all internal fields. This is the runtime equivalent of TypeScript's `Pick<T, K>`.

**Don't use this when** you need to remove specific fields while keeping the rest (use [`omit`](#compose-omit)). Don't use it when you want to add fields (use [`extend`](/composition/extend)).

### Examples

#### Example 1: Book catalog summary - only display fields

```ts
import { Compose, JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';
import { BookSchema } from './bookstore/index.js';

const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price', 'inStock'] as const,
  'https://bookstore.example/BookSummary',
);

type BookSummary = InferType<typeof BookSummarySchema>;
// { readonly isbn?: string; readonly title?: string; readonly price?: number; readonly inStock?: boolean }

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [BookSummarySchema] as const,
});

const summary = jt.instantiate(BookSummarySchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  price:   14.99,
  inStock: true,
  authors: ['Dostoevsky'],  // not picked  - stripped during coerce
});
// { isbn: '...', title: '...', price: 14.99, inStock: true }
// authors is gone
```

#### Example 2: Customer card for embedding in order responses

```ts
import { Compose } from 'json-tology';
import { CustomerSchema } from './bookstore/index.js';

const CustomerCardSchema = Compose.pick(
  CustomerSchema,
  ['id', 'name', 'email'] as const,
  'https://bookstore.example/CustomerCard',
);
// Useful for embedding customer info in Order responses without Address data
```

#### Example 3: Build sub-schema for partial validation (builds on subschemaAt)

```ts
import { Compose, JsonTology } from 'json-tology';
import { ReviewSchema } from './bookstore/index.js';

const ReviewRatingSchema = Compose.pick(
  ReviewSchema,
  ['rating'] as const,
  'https://bookstore.example/ReviewRating',
);

const jt2 = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [ReviewRatingSchema] as const,
});

// Validate just the rating field on blur
const errors = jt2.validate(ReviewRatingSchema.$id, { rating: 6 });
// ['/rating: must be <= 5']
```

### Bad examples - what NOT to do

#### Anti-pattern 1: Forgetting `as const` on the keys array

```ts
// ⊥ Don't do this  - without as const, keys array widens to string[] and TypeScript loses the literal types
const schema = Compose.pick(BookSchema, ['isbn', 'title'], '...');

// ✓ Do this
const schema2 = Compose.pick(BookSchema, ['isbn', 'title'] as const, '...');
```

### Comparison

::: code-group

```ts [json-tology]
Compose.pick(BookSchema, ['isbn', 'title', 'price'] as const, 'https://bookstore.example/BookSummary')
```

```ts [Zod]
BookSchema.pick({ isbn: true, title: true, price: true })
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
// TypeBox has Type.Pick:
Type.Pick(BookSchema, ['isbn', 'title', 'price'])
```

```ts [AJV]
// Manual construction:
const BookSummary = {
  $id: 'BookSummary',
  type: 'object',
  properties: { isbn: BookSchema.properties.isbn, title: BookSchema.properties.title, price: BookSchema.properties.price },
  required: BookSchema.required?.filter(k => ['isbn', 'title', 'price'].includes(k)),
};
```

```py [Pydantic]
book.model_dump(include={'isbn', 'title', 'price'})
# Or define a separate model class:
class BookSummary(BaseModel):
    isbn: str
    title: str
    price: float
```

:::

### Related

- [`omit`](#compose-omit) - inverse: keep everything except specified keys
- [`extend`](/composition/extend) - add new properties
- [`partial`](/composition/partial-required) - make all properties optional

---

## `Compose.omit` {#compose-omit}

**Declaration.** Creates a new schema with the specified property keys removed from `properties`. Removed keys are also dropped from `required`. TypeScript infers a type without the omitted properties.

**Use this when** you need to remove specific fields while keeping the rest - for example, stripping `currency` from `Book` for a region-normalized API, or removing `addresses` from `Customer` for a public profile endpoint. This is the runtime equivalent of TypeScript's `Omit<T, K>`.

**Don't use this when** you need to keep only specific fields (use [`pick`](#compose-pick)). Don't use it when you want to add fields (use [`extend`](/composition/extend)).

### Examples

#### Example 1: Public book without internal currency field

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './bookstore/index.js';

const PublicBookSchema = Compose.omit(
  BookSchema,
  ['currency'] as const,
  'https://bookstore.example/PublicBook',
);
// All Book properties except currency
// currency was optional (has default) so required array unchanged
```

#### Example 2: Order summary without line items

```ts
import { Compose } from 'json-tology';
import { OrderSchema } from './bookstore/index.js';

const OrderSummarySchema = Compose.omit(
  OrderSchema,
  ['items'] as const,
  'https://bookstore.example/OrderSummary',
);

type OrderSummary = InferType<typeof OrderSummarySchema>;
// { id, customerId, total, currency?, placedAt }  - no items array
```

#### Example 3: Build a derived schema from a retrieved schema (builds on get)

```ts
import { Compose } from 'json-tology';
import { bookstoreEntities as entities, BookSchema } from './bookstore/index.js';

// Retrieve and narrow dynamically
const raw = jt.get(BookSchema.$id);
if (raw) {
  const BookWithoutStock = Compose.omit(
    raw as typeof BookSchema,
    ['inStock'] as const,
    'https://bookstore.example/BookWithoutStock',
  );
  jt.register(BookWithoutStock);
}
```

### Comparison

::: code-group

```ts [json-tology]
Compose.omit(CustomerSchema, ['addresses'] as const, 'https://bookstore.example/CustomerPublic')
```

```ts [Zod]
CustomerSchema.omit({ addresses: true })
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
Type.Omit(CustomerSchema, ['addresses'])
```

```ts [AJV]
// Manual  - copy schema, delete key from properties and required:
const { addresses: _, ...props } = CustomerSchema.properties;
const req = CustomerSchema.required?.filter(k => k !== 'addresses') ?? [];
const CustomerPublic = { ...CustomerSchema, properties: props, required: req };
```

```py [Pydantic]
customer.model_dump(exclude={'addresses'})
# Or define a derived model:
class CustomerPublic(BaseModel):
    id: str
    email: str
    name: str
```

:::

### Related

- [`pick`](#compose-pick) - keep only specified fields
- [`partial`](/composition/partial-required) - make remaining fields optional after omit
- [`extend`](/composition/extend) - add new properties

## See also

- [Bookstore domain](/bookstore-domain) - where `BookSchema`, `CustomerSchema`, `OrderSchema` are defined
- [Composition index](/composition/) - overview of all composition operations
