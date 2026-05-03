# Materialization

> This guide covers `jt.materialize`. All examples use the [bookstore domain](/bookstore-domain). See [Value Operations](/value#jtvaluecreate) for `value.create`, which produces zero-value instances; see [Validation](/validation#coerce) for `coerce`, which validates and fills defaults in one pass.

`materialize()` builds a fully-populated instance by merging partial input with schema defaults. It is the right tool for constructing entity instances from known partial data — such as form state — where some fields have defaults and others are supplied.

---

## materialize

Materializes an entity instance with schema defaults applied, optionally merging partial input.

### Signature

```ts
public materialize<TSchema>(
  schema: TSchema,
  partial?: Partial<InferSchemaType<TSchema>>
): MaterializedSchemaType<TSchema>
```

### When to use

Use `materialize` when you have partial data and want defaults filled in — for example, creating a new `Book` from admin input where `currency` and `inStock` default to `'USD'` and `true`. Contrast with:

- `coerce(schemaId, data)` — validates arbitrary data, strips unknowns, applies defaults, throws on failure. Best for ingesting untrusted input.
- `value.create(schemaId)` — synthesizes zero-values for required fields that have no default. Best for blank form initialization.
- `materialize(schema, partial)` — merges trusted partial with defaults. Best for constructing known entities.

### Examples

#### Example 1: Materialize a new book with only required fields

Schema defaults (`currency: 'USD'`, `inStock: true`) are applied automatically.

```ts
import { JsonTology } from 'json-tology';

// jt is pre-built with BookSchema registered (see /bookstore-domain)

const book = jt.materialize(BookSchema, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
console.log(book);
// {
//   isbn:     '9780140449136',
//   title:    'Crime and Punishment',
//   authors:  ['Fyodor Dostoevsky'],
//   price:    14.99,
//   currency: 'USD',     ← from default
//   inStock:  true,      ← from default
// }
```

#### Example 2: Materialize a customer with an empty address list

`addresses` has `default: []` in `CustomerSchema`. Materializing without supplying addresses fills it in.

```ts
const customer = jt.materialize(CustomerSchema, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});
console.log(customer.addresses); // []
```

#### Example 3: Materialize with no partial input

When called with no second argument, `materialize` produces a value populated entirely from defaults. Fields with no default and no zero-value may be absent.

```ts
const partial = jt.materialize(BookSchema);
console.log(partial);
// { currency: 'USD', inStock: true }
// isbn, title, authors, price are absent — they have no declared defaults
```

#### Example 4: Compare materialize vs value.create vs coerce

```ts
// materialize — merges partial with defaults
const fromPartial = jt.materialize(BookSchema, { isbn: '9780140449136', title: 'Crime...', authors: ['Dostoevsky'], price: 14.99 });
// → { isbn: '...', title: '...', authors: [...], price: 14.99, currency: 'USD', inStock: true }

// value.create — zero-values for ALL required fields + explicit defaults
const fromCreate = jt.value.create(BookSchema.$id);
// → { isbn: '', title: '', authors: [], price: 0, currency: 'USD', inStock: true }

// coerce — validates untrusted input, applies defaults, strips extras, throws on failure
const fromCoerce = jt.coerce(BookSchema.$id, { isbn: '9780140449136', title: 'Crime...', authors: ['Dostoevsky'], price: 14.99, extra: 'gone' });
// → { isbn: '...', title: '...', authors: [...], price: 14.99, currency: 'USD', inStock: true }
// (same shape, but extra was stripped and validation ran)
```

### Comparison

::: code-group

```ts [json-tology]
const book = jt.materialize(BookSchema, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
// → currency: 'USD', inStock: true applied from defaults
```

```ts [Zod]
// Zod applies defaults during parse():
const book = BookSchema.parse({
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
// Requires .default() on each field in the schema definition.
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
// Value.Default fills defaults; Value.Create synthesizes zero-values.
const book = Value.Default(BookSchema, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
```

```ts [AJV]
// AJV applies defaults during validation with { useDefaults: true }:
const ajv = new Ajv({ useDefaults: true });
const data = { isbn: '9780140449136', title: '...', authors: [...], price: 14.99 };
ajv.validate(bookSchema, data); // mutates data in place with defaults
// data.currency === 'USD', data.inStock === true
```

```py [Pydantic]
# Pydantic applies defaults at model construction time:
book = Book(
    isbn='9780140449136',
    title='Crime and Punishment',
    authors=['Fyodor Dostoevsky'],
    price=14.99,
    # currency and in_stock use defaults
)
```

:::

### Related

- [Value Operations](/value#jtvaluecreate) — `value.create` for zero-value skeleton instances
- [Validation](/validation#coerce) — `coerce` for validating + materializing untrusted input
- [Computed Fields](/computed) — computed properties run after materialization
- [Invariants](/invariants) — cross-field rules that run after materialization
