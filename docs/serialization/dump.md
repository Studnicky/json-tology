# `jt.dump` and `jt.dumpJson`

`dump` and `dumpJson` are a symmetric pair with `instantiate`: `instantiate` ingests and decodes wire data; `dump` / `dumpJson` encodes domain data back to wire form.

---

## `jt.dump` {#jt-dump}

**Declaration.** Walks the canonical schema graph for the given `schemaId`, applies any registered `Transform` encoder at each node, filters the result according to options, and returns a wire-form JS value (`unknown`). The input `value` is not mutated.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'wire' \| 'json'` | `'wire'` | `'json'` converts `Date` values to ISO strings for `JSON.stringify` safety |
| `exclude` | `readonly string[]` | - | Property names to drop (ignored when `include` is set) |
| `include` | `readonly string[]` | - | Property names to keep (takes precedence over `exclude`) |
| `excludeUnset` | `boolean` | `false` | Drop properties whose runtime value is `undefined` |
| `excludeDefaults` | `boolean` | `false` | Drop properties whose value strictly equals the schema `default` |

**Use this when** you need to serialize a domain object back to wire form - before storing in a database, before sending over HTTP, before publishing to a queue. Use the filtering options to produce compact payloads or specific projections. Use `dumpJson` when you need a JSON string directly.

**Don't use this when** you want a complete validated object (use `instantiate` instead - it goes the other direction). Don't call it on raw unvalidated input - `dump` expects a value that has already been through `instantiate` or `materialize`.

### Examples

#### Example 1: Basic serialization of a coerced book

```ts
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

const book = bookstoreEntities.instantiate(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
  // currency defaults to 'USD', inStock defaults to true
});

// Wire-form output  - all fields including defaults
const wire = bookstoreEntities.dump(BookSchema.$id, book);
// { isbn: '...', title: '...', authors: [...], price: 14.99, currency: 'USD', inStock: true }
```

#### Example 2: Compact payload - exclude default-valued fields

```ts
const compact = jt.dump(BookSchema.$id, book, { excludeDefaults: true });
// { isbn: '...', title: '...', authors: [...], price: 14.99 }
// currency: 'USD' and inStock: true are omitted (equal to schema defaults)
```

#### Example 3: Project to specific fields

```ts
const listing = jt.dump(BookSchema.$id, book, { include: ['isbn', 'title', 'price'] });
// { isbn: '9780140449136', title: 'Crime and Punishment', price: 14.99 }
```

#### Example 4: Transform integration - `encode` applied automatically

If the schema has a `Transform` encoder registered (see [Transforms](/transforms/decode-encode)), `dump` applies the `encode` function at each transformed node. A `instantiate` → `dump` round-trip recovers the original wire value.

```ts
import { Transform } from 'json-tology';

const PlacedAtSchema = Transform.create(
  { $id: 'https://bookstore.example/PlacedAt', type: 'string', format: 'date-time' } as const,
  {
    decode: (s: string) => new Date(s),
    encode: (d: Date) => d.toISOString()
  },
);

const date = jt.instantiate(PlacedAtSchema.$id, '2026-01-15T10:30:00.000Z');
const wire = jt.dump(PlacedAtSchema.$id, date as Date);
// '2026-01-15T10:30:00.000Z'  - encode applied automatically
```

### Bad examples - what NOT to do

#### Anti-pattern 1: Calling dump on raw (uninstantiated) input

```ts
// ⊥ Don't do this  - dump expects an instantiated domain value, not raw input
const raw = { isbn: '9780140449136', title: 'Crime...', authors: ['Dostoevsky'], price: '14.99' };
const wire = jt.dump(BookSchema.$id, raw as Book);
// price is still '14.99' string  - not coerced; dump just applies encode, not type coercion

// ✓ Do this  - instantiate first, then dump
const book = jt.instantiate(BookSchema.$id, raw);
const wireBook = jt.dump(BookSchema.$id, book);
```

### Comparison

::: code-group

```ts [json-tology]
const wire = jt.dump(BookSchema.$id, book);
const wire2 = jt.dump(BookSchema.$id, book, { excludeDefaults: true });
const json = jt.dumpJson(BookSchema.$id, book); // JSON string
```

```ts [Zod]
// Zod doesn't have a separate dump/serialize step.
// The parsed value is already in the desired shape.
const json = JSON.stringify(book);
// No exclude/include filtering without manual code.
```

```ts [Valibot]
// Limitation: Valibot has no dump/serialize step and no encode direction.
// JSON.stringify the value directly; encoding of branded or transformed
// fields (e.g. Date) must be applied manually before stringify.
const json = JSON.stringify(book);
```

```ts [io-ts]
// Limitation: io-ts has no dump step that walks a graph and applies encoders.
// Each codec exposes .encode for itself; for a composite, call .encode at
// the top level then JSON.stringify. No filtering options.
const wire = BookCodec.encode(book);
const json = JSON.stringify(wire);
```

```ts [TypeBox + Value]
// TypeBox does not have a built-in dump/serialize utility.
const json = JSON.stringify(book);
```

```ts [AJV]
// AJV validates  - no serialize step.
const json = JSON.stringify(book);
```

```py [Pydantic]
wire = book.model_dump()
json_str = book.model_dump_json()
# Filtering options:
book.model_dump(exclude={'currency', 'in_stock'})
book.model_dump(include={'isbn', 'title', 'price'})
book.model_dump(exclude_defaults=True)
book.model_dump(exclude_none=True)
```

:::

---

## `jt.dumpJson` {#jt-dumpjson}

**Declaration.** Convenience wrapper around `dump()` with `mode: 'json'` forced. Equivalent to `JSON.stringify(jt.dump(schemaId, value, { mode: 'json', ...options }))`. Returns a JSON string. The `mode` option is not available on `dumpJson` - it is always `'json'`.

**Use this when** you need a JSON string directly - HTTP response bodies, log records, message queue payloads.

### Examples

#### Example 1: Serialize a customer for an HTTP response

```ts
const customer = jt.instantiate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

const json = jt.dumpJson(CustomerSchema.$id, customer);
// '{"id":"...","email":"alice@bookstore.example","name":"Alice Chen","addresses":[]}'

// In an Express handler:
// res.type('application/json').send(json);
```

#### Example 2: Compact order payload

```ts
const orderJson = jt.dumpJson(OrderSchema.$id, order, { excludeDefaults: true });
// JSON string without currency: 'USD'
```

### Comparison

::: code-group

```ts [json-tology]
const json = jt.dumpJson(CustomerSchema.$id, customer);
// JSON string; Date fields encoded to ISO via Transform encoders
```

```ts [Zod]
const json = JSON.stringify(customer);
// Date objects must be converted manually before stringify.
```

```ts [Valibot]
// Limitation: no dumpJson; JSON.stringify works only for plain values.
const json = JSON.stringify(customer);
```

```ts [io-ts]
// Limitation: no dumpJson convenience; combine .encode and JSON.stringify.
const json = JSON.stringify(CustomerCodec.encode(customer));
```

```ts [TypeBox + Value]
const json = JSON.stringify(customer);
```

```ts [AJV]
const json = JSON.stringify(customer);
```

```py [Pydantic]
json_str = customer.model_dump_json()
# Equivalent; datetime fields serialized to ISO automatically.
```

:::

## Related

- [`JsonTology.instantiate`](/validation/instantiate) - the incoming direction (wire → domain)
- [`jt.encode`](/transforms/decode-encode#jtencode) - apply a single Transform encoder
- [Transforms](/transforms/decode-encode) - how Transform encoders are registered and applied

## See also

- [Bookstore domain](/bookstore-domain) - where `Book`, `Customer`, `Order` are defined
