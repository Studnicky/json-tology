# `JsonTology.materialize`

**Declaration.** Builds a fully-populated instance by merging optional partial input with the schema's declared `default` values. Returns a `MaterializedSchemaType<TSchema>`. Does not throw when partial data is omitted — if partial is provided and structurally invalid, validation failures may surface. Does not strip unknown properties from partial input (partial is trusted); use [`coerce`](/validation/coerce) for untrusted input.

**Use this when** you have trusted partial data (from a factory, a test fixture, an admin form) and want the missing fields filled in from schema defaults. The canonical use case: creating a new entity with some known fields, leaving the rest to defaults.

**Don't use this when** the input is untrusted or may carry unknown properties (use [`coerce`](/validation/coerce) instead — it validates, strips unknowns, and applies defaults). Don't use it when you want a completely blank instance with zero-values (use [`jt.value.create`](/value/create) instead).

## Examples

### Example 1: Build a new Book from required fields only

`currency` and `inStock` have declared defaults — they are filled in automatically.

```ts
import { bookstoreEntities as entities, BookSchema } from './bookstore/index.js';

const book = jt.materialize(BookSchema, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});

console.log(book.currency); // 'USD'  ← from default
console.log(book.inStock);  // true   ← from default
```

### Example 2: Materialize a Customer — addresses default is empty array

```ts
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

const customer = jt.materialize(CustomerSchema, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

console.log(customer.addresses); // []  ← default applied
```

### Example 3: Contrast with coerce and value.create

```ts
// materialize — fills declared defaults, partial is trusted
const m = jt.materialize(BookSchema, { isbn: '9780140449136', title: '...', authors: ['...'], price: 14.99 });
// → { isbn: '...', title: '...', authors: [...], price: 14.99, currency: 'USD', inStock: true }

// value.create — fills ALL required fields with zero-values + explicit defaults
const c = jt.value.create(BookSchema.$id);
// → { isbn: '', title: '', authors: [], price: 0, currency: 'USD', inStock: true }

// coerce — validates, strips unknowns, applies defaults, throws on failure
const o = jt.coerce(BookSchema.$id, rawInput);
// → same shape, but validates and throws CoercionError if rawInput is invalid
```

## Bad examples — what NOT to do

### Anti-pattern 1: Using materialize for untrusted API input

```ts
// ⊥ Don't do this — materialize doesn't validate or strip unknowns
const book = jt.materialize(BookSchema, req.body as Partial<Book>);
// Unknown fields from req.body will appear in the result unchecked

// ✓ Do this — coerce validates, strips unknowns, applies defaults
const book2 = jt.coerce(BookSchema.$id, req.body);
```

## Comparison

::: code-group

```ts [json-tology]
jt.materialize(BookSchema, {
  isbn: '9780140449136', title: 'Crime and Punishment',
  authors: ['Dostoevsky'], price: 14.99,
})
// → currency: 'USD', inStock: true applied from declared defaults
```

```ts [Zod]
// Zod applies defaults during parse(); no separate materialize step:
const book = BookSchema.parse({
  isbn: '9780140449136', title: 'Crime and Punishment',
  authors: ['Dostoevsky'], price: 14.99,
});
// Requires .default() on each field in the schema definition.
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
// Value.Default fills defaults:
const book = Value.Default(BookSchema, {
  isbn: '9780140449136', title: '...', authors: [...], price: 14.99,
});
```

```ts [AJV]
// AJV applies defaults during validation with { useDefaults: true }:
const ajv = new Ajv({ useDefaults: true });
const data = { isbn: '...', title: '...', authors: [...], price: 14.99 };
ajv.validate(bookSchema, data);  // mutates data in place with defaults
```

```py [Pydantic]
book = Book(isbn='9780140449136', title='Crime and Punishment',
            authors=['Dostoevsky'], price=14.99)
# currency and in_stock filled from defaults automatically
```

:::

## Related

- [`JsonTology.coerce`](/validation/coerce) — validate + apply defaults + strip unknowns (for untrusted input)
- [`jt.value.create`](/value/create) — zero-value instance for blank form initialization
- [`Compose.getDefaults`](/composition/get-defaults) — extract declared defaults without building an instance
- [Computed fields](/registry/computed) — computed properties also run after materialization

## See also

- [Bookstore domain](/bookstore-domain) — where `BookSchema` and `CustomerSchema` are defined
