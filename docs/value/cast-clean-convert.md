# `value.cast`, `value.clean`, and `value.convert`

Schema-aware instance methods on `jt.value`. All three operate against the registry and require `castTypes: true` in `JsonTology.create` options for type coercion to work.

---

## `value.cast` {#value-cast}

**Declaration.** Coerces types (e.g. `"9.99"` → `9.99`, `"true"` → `true`) and applies schema `default` values. Requires `castTypes: true`. Throws `CoercionError` when the coerced data fails validation.

**Use this when** ingesting data from sources that serialize numbers and booleans as strings — CSV imports, URL query parameters, HTML form submissions, `application/x-www-form-urlencoded` bodies.

**Don't use this when** the source data is already properly typed (use [`coerce`](/validation/coerce) instead). Don't use `cast` when you want type coercion but not defaults (use [`convert`](#value-convert)).

### Examples

#### Example 1: Cast form input with string numbers

```ts
import { JsonTology } from 'json-tology';
import { BookSchema } from './bookstore/schemas.js';

const jt = JsonTology.create({
  baseIRI:   'https://bookstore.example',
  schemas:   [BookSchema] as const,
  castTypes: true,
});

const book = jt.value.cast(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   '14.99',   // string → coerced to number
  inStock: 'true',    // string → coerced to boolean
});
// { isbn: '...', ..., price: 14.99, inStock: true, currency: 'USD' }
```

#### Example 2: Cast URL query params for a Review filter

```ts
// req.query.rating is '4' (string)
const params = jt.value.cast(ReviewSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  bookIsbn:   '9780140449136',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  rating:     req.query.rating,  // '4' → 4
  body:       'Absolutely gripping from start to finish.',
  postedAt:   new Date().toISOString(),
});
console.log(params.rating); // 4 (number)
```

### Comparison

::: code-group

```ts [json-tology]
const jt = JsonTology.create({ ..., castTypes: true });
const book = jt.value.cast(BookSchema.$id, rawData); // strings coerced
```

```ts [Zod]
// Zod uses .coerce() wrappers per-field:
const BookSchema = z.object({
  price:   z.coerce.number(),
  inStock: z.coerce.boolean(),
});
const book = BookSchema.parse(rawData);
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
const book = Value.Convert(BookSchema, rawData); // type conversion
```

```ts [AJV]
// AJV has { coerceTypes: true } option:
const ajv = new Ajv({ coerceTypes: true });
ajv.validate(bookSchema, rawData); // rawData mutated in place
```

```py [Pydantic]
# Pydantic v2 coerces compatible types by default (strict=False):
book = Book.model_validate(raw_data)  # '14.99' → 14.99
```

:::

---

## `value.clean` {#value-clean}

**Declaration.** Strips properties not declared in the schema from the data. Throws `CoercionError` when the cleaned data fails validation.

**Use this when** you need to sanitize data that may carry extra properties not in the schema — for example, third-party API responses, database rows with extra columns, or enriched records that need to be reduced before forwarding.

**Don't use this when** you want defaults to be applied too (use [`coerce`](/validation/coerce) which does both). Use `clean` when you specifically want only stripping, no defaults.

### Examples

#### Example 1: Strip internal fields from an API response

```ts
const apiResponse = {
  isbn:         '9780140449136',
  title:        'Crime and Punishment',
  authors:      ['Fyodor Dostoevsky'],
  price:        14.99,
  _internal_id: 'int-001',       // not in BookSchema
  _cache_key:   'k:9780140449136', // not in BookSchema
};

const cleaned = jt.value.clean(BookSchema.$id, apiResponse);
// { isbn: '...', title: '...', authors: [...], price: 14.99 }
// _internal_id and _cache_key are gone
```

### Comparison

::: code-group

```ts [json-tology]
const cleaned = jt.value.clean(BookSchema.$id, data);
// Unknown properties stripped; validation error thrown if invalid
```

```ts [Zod]
// Zod's default .parse() strips unknown keys:
const cleaned = BookSchema.parse(data);
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
Value.Clean(BookSchema, Value.Clone(data)); // removes additional properties
```

```ts [AJV]
// AJV with { removeAdditional: true }:
const ajv = new Ajv({ removeAdditional: true });
ajv.validate(bookSchema, data); // mutates data in place
```

```py [Pydantic]
# Pydantic ignores extra fields by default (model_config extra='ignore'):
cleaned = Book.model_validate(data)
```

:::

---

## `value.convert` {#value-convert}

**Declaration.** Coerces types without applying schema `default` values. Requires `castTypes: true`. Throws `CoercionError` when the data fails validation after type conversion.

**Use this when** you want type coercion but explicitly want to control which defaults are applied. Contrast: `cast` = coerce types + fill defaults; `convert` = coerce types only; `coerce` = coerce types + fill defaults + strip unknowns + run transforms.

### Examples

#### Example 1: Convert types for a partial review without filling defaults

```ts
const converted = jt.value.convert(ReviewSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  bookIsbn:   '9780140449136',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  rating:     '5',    // coerced to number 5
  body:       'One of the greatest novels ever written.',
  postedAt:   '2026-01-15T10:30:00Z',
});
console.log(converted.rating); // 5 (number)
```

## Related

- [`JsonTology.coerce`](/validation/coerce) — validate + apply defaults + strip unknowns + run transforms
- [`value.create`](/value/create) — synthesize a zero-value blank instance

## See also

- [Bookstore domain](/bookstore-domain) — where `Book`, `Review` are defined
