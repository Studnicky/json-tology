# `Compose.pick` and `Compose.omit`

> Validation modes: [Validation modes reference](/validation-modes)

`pick` and `omit` are inverse operations for creating schema projections. Both return new schema objects - input schemas are never mutated.

---

## `Compose.pick` {#compose-pick} <Badge type="warning" text="Compile-time + Runtime" />

**Declaration.** Creates a new schema containing only the specified property keys. The `required` array is filtered to include only keys that were in the original `required` and appear in the `keys` argument. Non-picked `required` fields are dropped. TypeScript infers a type with only the picked properties.

**Use this when** you need a schema that exposes only a subset of fields - for API projections, list-view summaries, or public interfaces that should not expose all internal fields. This is the runtime equivalent of TypeScript's `Pick<T, K>`.

**Don't use this when** you need to remove specific fields while keeping the rest (use [`omit`](#compose-omit)). Don't use it when you want to add fields (use [`extend`](/composition/extend)).

### Examples

#### Example 1: Book catalog summary - only display fields

<RunnableExample src="examples/docs/composition/02-pick-omit" />

#### Example 2: Customer card for embedding in order responses

<RunnableExample src="examples/docs/composition/21-pick-customer-card" />

#### Example 3: Build sub-schema for partial validation (builds on subschemaAt)

<RunnableExample src="examples/docs/composition/22-pick-review-rating-subschema" />

### Argument validation <Badge type="info" text="Compile-time" />

`keys` are bound to `keyof properties`. Passing a key that does not exist in the source schema's `properties` is a compile-time error rather than a silent empty-properties result.

<RunnableExample src="examples/docs/composition/47-antipattern-pick-unknown-key" />

### Bad examples - what NOT to do

#### Anti-pattern 1: Forgetting `as const` on the keys array

<RunnableExample src="examples/docs/composition/23-antipattern-pick-without-as-const" />

### Comparison

::: code-group

```ts [json-tology]
Compose.pick(BookSchema, ['isbn', 'title', 'price'] as const, 'https://bookstore.example/BookSummary')
```

```ts [Zod]
BookSchema.pick({ isbn: true, title: true, price: true })
```

```ts [Valibot]
import * as v from 'valibot';
v.pick(BookSchema, ['isbn', 'title', 'price'])
```

```ts [io-ts]
import * as t from 'io-ts';
// Limitation: io-ts has no built-in pick. Reconstruct the codec from the
// fields you want, or use t.intersection of a subset codec.
const BookSummary = t.type({
  isbn:  BookCodec.props.isbn,
  title: BookCodec.props.title,
  price: BookCodec.props.price,
});
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


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

### Related

- [`omit`](#compose-omit) - inverse: keep everything except specified keys
- [`extend`](/composition/extend) - add new properties
- [`partial`](/composition/partial-required) - make all properties optional

---

## `Compose.omit` {#compose-omit} <Badge type="warning" text="Compile-time + Runtime" />

**Declaration.** Creates a new schema with the specified property keys removed from `properties`. Removed keys are also dropped from `required`. TypeScript infers a type without the omitted properties.

**Use this when** you need to remove specific fields while keeping the rest - for example, stripping `currency` from `Book` for a region-normalized API, or removing `addresses` from `Customer` for a public profile endpoint. This is the runtime equivalent of TypeScript's `Omit<T, K>`.

**Don't use this when** you need to keep only specific fields (use [`pick`](#compose-pick)). Don't use it when you want to add fields (use [`extend`](/composition/extend)).

### Examples

#### Example 1: Public book without internal currency field

<RunnableExample src="examples/docs/composition/24-omit-public-book" />

#### Example 2: Order summary without line items

<RunnableExample src="examples/docs/composition/25-omit-order-summary" />

#### Example 3: Build a derived schema from a retrieved schema (builds on get)

<RunnableExample src="examples/docs/composition/26-omit-from-registry" />

### Argument validation <Badge type="info" text="Compile-time" />

`keys` are bound to `keyof properties`, the same constraint `pick` uses. Passing a key that does not exist in the source schema's `properties` is a compile-time error rather than a silent no-op.

### Comparison

::: code-group

```ts [json-tology]
Compose.omit(CustomerSchema, ['addresses'] as const, 'https://bookstore.example/CustomerPublic')
```

```ts [Zod]
CustomerSchema.omit({ addresses: true })
```

```ts [Valibot]
import * as v from 'valibot';
v.omit(CustomerSchema, ['addresses'])
```

```ts [io-ts]
import * as t from 'io-ts';
// Limitation: io-ts has no built-in omit. Rebuild the codec from the fields
// you want to keep.
const { addresses: _drop, ...rest } = CustomerCodec.props;
const CustomerPublic = t.type(rest);
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


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

### Related

- [`pick`](#compose-pick) - keep only specified fields
- [`partial`](/composition/partial-required) - make remaining fields optional after omit
- [`extend`](/composition/extend) - add new properties

## See also

- [Bookstore domain](/bookstore-domain) - where `BookSchema`, `CustomerSchema`, `OrderSchema` are defined
- [Composition index](/composition/) - overview of all composition operations
