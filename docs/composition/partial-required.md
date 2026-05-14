# `Compose.partial` and `Compose.required` <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

`partial` and `required` are inverse operations for adjusting the required-ness of all properties. Both return new schema objects - inputs are never mutated.

---

## `Compose.partial` {#compose-partial}

**Declaration.** Creates a new schema by removing the `required` array entirely. All properties become optional. TypeScript infers a type with all properties optional - the equivalent of `Partial<T>`. The `$id` is replaced with `newId`.

**Use this when** you need a PATCH-body schema where any combination of fields may be provided. Also useful for form state where all fields start empty and become required only on submit.

**Don't use this when** you only want specific fields to be optional (use [`pick`](/composition/pick-omit) to select and then omit required from only those). Don't use it when you want to remove specific fields entirely (use [`omit`](/composition/pick-omit)).

### Examples

#### Example 1: PATCH customer endpoint

```ts
import { Compose, JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';
import { CustomerSchema } from './bookstore/index.js';

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer',
);

type PatchCustomer = InferType<typeof PatchCustomerSchema>;
// { id?: string; email?: string; name?: string; addresses?: Address[] }

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [PatchCustomerSchema] as const,
});

// PATCH body  - only name provided
const patch = jt.instantiate(PatchCustomerSchema.$id, { name: 'Alice P. Chen' });
// { name: 'Alice P. Chen' }
```

#### Example 2: Form initial state for a Review

```ts
import { Compose, JsonTology } from 'json-tology';
import { ReviewSchema } from './bookstore/index.js';

const DraftReviewSchema = Compose.partial(
  ReviewSchema,
  'https://bookstore.example/DraftReview',
);

// Valid even with nothing filled in  - all optional
const jt2 = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [DraftReviewSchema] as const,
});
const errors = jt2.validate(DraftReviewSchema.$id, {});
console.log(errors.length === 0); // true
```

### Comparison

::: code-group

```ts [json-tology]
Compose.partial(CustomerSchema, 'https://bookstore.example/PatchCustomer')
```

```ts [Zod]
CustomerSchema.partial()
```

```ts [Valibot]
import * as v from 'valibot';
v.partial(CustomerSchema)
```

```ts [io-ts]
import * as t from 'io-ts';
// io-ts has t.partial which makes every property optional:
const PatchCustomer = t.partial(CustomerCodec.props);
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
Type.Partial(CustomerSchema)
```

```ts [AJV]
// Manual  - copy schema, remove required:
const { required: _, ...PatchCustomer } = CustomerSchema;
PatchCustomer.$id = 'https://bookstore.example/PatchCustomer';
```

```py [Pydantic]
# Create a PATCH model manually with Optional fields:
class PatchCustomer(BaseModel):
    name: str | None = None
    email: str | None = None
    # Or use model_fields_set to track which fields were provided.
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

- [`required`](#compose-required) - inverse: make all fields required
- [`pick`](/composition/pick-omit) - subset of fields, combined with partial for partial sub-schemas
- [`extend`](/composition/extend) - add fields before making partial

---

## `Compose.required` {#compose-required}

**Declaration.** Creates a new schema where every declared property in `properties` is listed in `required`. The resulting `required` array is `Object.keys(schema.properties)`. TypeScript infers a type with all properties required - the equivalent of `Required<T>`. The `$id` is replaced with `newId`.

**Use this when** you need a strict create-body schema that demands all fields, even those that have defaults. Useful for internal service calls where missing defaults should be caught, or for admin APIs that require full objects.

**Don't use this when** you only want specific fields to be required (build a combined schema with `intersection` instead).

### Examples

#### Example 1: Strict book creation requiring all fields

`BookSchema` has `currency` and `inStock` with defaults (so they're effectively optional in the base schema). A strict create schema requires them explicitly.

```ts
import { Compose, JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';
import { BookSchema } from './bookstore/index.js';

const CreateBookSchema = Compose.required(
  BookSchema,
  'https://bookstore.example/CreateBook',
);

type CreateBook = InferType<typeof CreateBookSchema>;
// { isbn: string; title: string; authors: string[]; price: number; currency: string; inStock: boolean }
// ALL fields required

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CreateBookSchema] as const,
});

// Missing currency and inStock
const errors = jt.validate(CreateBookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
console.log(errors.length > 0); // true  - currency and inStock are now required
```

### Comparison

::: code-group

```ts [json-tology]
Compose.required(BookSchema, 'https://bookstore.example/CreateBook')
```

```ts [Zod]
BookSchema.required()
```

```ts [Valibot]
import * as v from 'valibot';
v.required(BookSchema)
```

```ts [io-ts]
import * as t from 'io-ts';
// io-ts treats every t.type field as required already. To force a partial
// codec back to fully required, rebuild with t.type:
const CreateBook = t.type(BookCodec.props);
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
Type.Required(BookSchema)
```

```ts [AJV]
// Manual  - set required = all property keys:
const CreateBook = {
  ...BookSchema,
  $id: 'https://bookstore.example/CreateBook',
  required: Object.keys(BookSchema.properties),
};
```

```py [Pydantic]
# Pydantic fields without defaults are already required.
# To make defaulted fields required, remove the defaults or use a validator.
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

- [`partial`](#compose-partial) - inverse: make all fields optional
- [`intersection`](/composition/intersection) - when some fields must be required from a second schema
- [`extend`](/composition/extend) - add fields before making required

## See also

- [Bookstore domain](/bookstore-domain) - where `CustomerSchema`, `BookSchema`, `ReviewSchema` are defined
- [Composition index](/composition/) - overview of all composition operations
