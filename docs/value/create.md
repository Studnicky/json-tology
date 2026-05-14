# `value.create`

**Declaration.** Synthesizes a zero-value default instance for a schema by filling every declared property with its `default` value if present, or with a type-based zero value if no default is declared (`''` for string, `0` for number/integer, `false` for boolean, `[]` for array, `{}` for object). Returns `unknown` - cast to the schema type for type-safe access.

**Use this when** you need a blank structural skeleton for a schema - for example, pre-populating a form's initial state where every field should have a zero value. Contrast with `materialize(schema)` which only fills declared defaults (leaves undeclared fields absent) and throws if required fields without defaults are missing.

**Don't use this when** you want a validated, coerced value from real input (use [`instantiate`](/validation/instantiate)). Don't use it when you only want declared defaults without zero-values (use [`Compose.getDefaults`](/composition/get-defaults)).

## Examples

### Example 1: Blank Book form state

```ts
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

const blank = bookstoreEntities.value.create(BookSchema.$id);
// {
//   isbn:     '',          ← zero-value for required string
//   title:    '',          ← zero-value for required string
//   authors:  [],          ← zero-value for required array
//   price:    0,           ← zero-value for required number
//   currency: 'USD',       ← explicit default preserved
//   inStock:  true,        ← explicit default preserved
// }
```

### Example 2: Blank Customer for testing

```ts
const blankCustomer = jt.value.create(CustomerSchema.$id);
// {
//   id:        '',
//   email:     '',
//   name:      '',
//   addresses: [],   ← default []
// }
```

### Example 3: Contrast with materialize and Compose.getDefaults

```ts
// value.create  - zero-values + explicit defaults, ALL required fields present
const fromCreate = jt.value.create(BookSchema.$id);
// { isbn: '', title: '', authors: [], price: 0, currency: 'USD', inStock: true }

// Compose.getDefaults  - only declared defaults (no zero-values)
const defaults = Compose.getDefaults(BookSchema);
// { currency: 'USD', inStock: true }
// isbn, title, authors, price absent  - they have no declared defaults

// materialize  - fill declared defaults, partial is trusted, throws if required missing
const m = jt.materialize(BookSchema, {
  isbn: '9780140449136', title: 'Crime and Punishment', authors: ['Dostoevsky'], price: 14.99,
});
// { isbn: '...', ..., currency: 'USD', inStock: true }
```

## Bad examples - what NOT to do

### Anti-pattern 1: Using value.create to generate valid instances for tests

```ts
// ⊥ Don't do this  - zero-values may not pass validation (empty strings, 0 price)
const blank = jt.value.create(BookSchema.$id);
jt.validate(BookSchema.$id, blank); // may have errors: isbn pattern fails, price ≤ 0

// ✓ Do this  - use actual test data
const testBook = jt.instantiate(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Test Book',
  authors: ['Test Author'],
  price:   9.99,
});
```

## Comparison

::: code-group

```ts [json-tology]
const blank = jt.value.create(BookSchema.$id);
// Zero-values + explicit defaults; all required fields present
```

```ts [Zod]
// Zod doesn't provide a zero-value creator.
// Closest: schema.parse({})  - fails for required fields without defaults.
// Use z.object({ ... }).optional()... with explicit defaults, or build manually.
```

```ts [Valibot]
// Limitation: Valibot has no zero-value creator.
// v.parse(BookSchema, {}) fails on required fields without v.optional defaults.
// Build the blank object manually for forms.
```

```ts [io-ts]
// Limitation: io-ts has no zero-value creator.
// BookCodec.decode({}) fails on required fields. Build the blank object
// manually for form scaffolding.
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
// Value.Create fills all fields with type defaults + declared defaults:
const blank = Value.Create(BookSchema);
```

```ts [AJV]
// AJV has no built-in zero-value creator.
// Workaround: validate an empty object with { useDefaults: true }:
const ajv = new Ajv({ useDefaults: true });
const blank = {};
ajv.validate(bookSchema, blank);
// Limitation: mutates the object in place; only fills declared defaults (not zero-values);
// missing required fields stay absent; no TypeScript type narrowing.
```

```py [Pydantic]
# Pydantic requires values for required fields  - no zero-value creation.
# Use Optional fields with None defaults or supply explicit test values:
Book(isbn='', title='', authors=[], price=0)
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

## Related

- [`JsonTology.materialize`](/registry/materialize) - fill from partial trusted data + declared defaults
- [`Compose.getDefaults`](/composition/get-defaults) - extract only declared defaults (no zero-values)
- [`JsonTology.instantiate`](/validation/instantiate) - validate + fill defaults + strip unknowns (for real data)

## See also

- [Bookstore domain](/bookstore-domain) - where `BookSchema` and `CustomerSchema` are defined
