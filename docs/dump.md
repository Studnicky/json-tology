# Serialization

> This guide covers `jt.dump` and `jt.dumpJson`. All examples use the [bookstore domain](/bookstore-domain). See [Transforms](/transforms) for how `Transform.create` registers the `encode` function that `dump` applies, and [Validation](/validation#coerce) for how `coerce` produces the values you serialize.

`dump()` serializes a validated JS value back to its wire representation — the Pydantic `model_dump()` equivalent. It walks the canonical graph for the schema, applies any registered `Transform` encoder at each node, and filters the result according to options.

---

## dump

Walks the canonical schema graph, applies Transform encoders, and returns the wire-form value.

### Signature

```ts
public dump<K extends keyof TMap & string>(
  schemaId: K,
  value: TMap[K],
  options?: DumpOptionsInterface
): unknown
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'wire' \| 'json'` | `'wire'` | `'json'` converts `Date` values to ISO strings for `JSON.stringify` safety |
| `exclude` | `readonly string[]` | — | Property names to drop. Ignored when `include` is set |
| `include` | `readonly string[]` | — | Property names to keep (all others dropped). Takes precedence over `exclude` |
| `excludeUnset` | `boolean` | `false` | Drop properties whose runtime value is `undefined` |
| `excludeDefaults` | `boolean` | `false` | Drop properties whose value strictly equals the schema `default` |

### When to use

Use `dump` at the boundary where domain objects leave your application — before writing to a database, before sending over HTTP, before publishing to a queue. It is the complement to `coerce`: `coerce` brings data in and decodes it; `dump` takes it out and encodes it back to wire form.

Use `dumpJson` as a convenience shorthand when you need a JSON string directly.

### Examples

#### Example 1: Basic serialization of a coerced book

```ts
import { JsonTology } from 'json-tology';

// Build a book via coerce (see /bookstore-domain and /validation#coerce)
const book = jt.coerce(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});

// Wire-form output — structurally identical to the coerced value
const wire = jt.dump(BookSchema.$id, book);
// {
//   isbn:     '9780140449136',
//   title:    'Crime and Punishment',
//   authors:  ['Fyodor Dostoevsky'],
//   price:    14.99,
//   currency: 'USD',
//   inStock:  true,
// }
```

#### Example 2: Exclude default-valued fields

For payloads that should be as compact as possible, drop fields whose values match the schema defaults.

```ts
const compact = jt.dump(BookSchema.$id, book, { excludeDefaults: true });
// {
//   isbn:    '9780140449136',
//   title:   'Crime and Punishment',
//   authors: ['Fyodor Dostoevsky'],
//   price:   14.99,
//   // currency and inStock omitted — they equal the defaults
// }
```

#### Example 3: Include only specific fields (projection)

```ts
const projection = jt.dump(BookSchema.$id, book, { include: ['isbn', 'title', 'price'] });
// { isbn: '9780140449136', title: 'Crime and Punishment', price: 14.99 }
```

#### Example 4: Dump an order with its lines

`OrderSchema` contains `items` (array of `OrderLine`). `dump` walks nested schemas transitively.

```ts
const order = jt.coerce(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      27.98,
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99 },
    { bookIsbn: '9780062316110', quantity: 1, unitPrice:  1.00 },
  ],
});

const wire = jt.dump(OrderSchema.$id, order);
// Full nested wire representation, currency: 'USD' included
```

### Comparison

::: code-group

```ts [json-tology]
const wire = jt.dump(BookSchema.$id, book);
const json = jt.dumpJson(BookSchema.$id, book); // convenience JSON string
// Options: exclude, include, excludeDefaults, excludeUnset, mode
```

```ts [Zod]
// Zod doesn't have a separate dump/serialize step.
// Parsed data is already in the desired shape.
// Use JSON.stringify directly or a custom serializer for transforms.
const json = JSON.stringify(book);
```

```ts [TypeBox]
// TypeBox does not have a built-in dump/serialize utility.
// Use JSON.stringify or manually apply transform encode functions.
const json = JSON.stringify(book);
```

```ts [AJV]
// AJV validates but does not serialize — use JSON.stringify.
const json = JSON.stringify(book);
```

```py [Pydantic]
# model_dump() is the direct equivalent:
wire = book.model_dump()
json_str = book.model_dump_json()

# Options:
book.model_dump(exclude={'currency', 'in_stock'})  # exclude specific fields
book.model_dump(include={'isbn', 'title', 'price'})  # include only specific fields
book.model_dump(exclude_defaults=True)  # exclude default-valued fields
book.model_dump(exclude_none=True)  # similar to excludeUnset
```

:::

### Related

- `dumpJson` — convenience wrapper returning a JSON string
- [Transforms](/transforms) — `encode` functions applied by `dump` during graph walking
- [Validation](/validation#coerce) — `coerce` produces the values you pass to `dump`

---

## dumpJson

Convenience wrapper around `dump()` with `mode: 'json'`. Returns a `JSON.stringify`-ready string.

### Signature

```ts
public dumpJson<K extends keyof TMap & string>(
  schemaId: K,
  value: TMap[K],
  options?: Omit<DumpOptionsInterface, 'mode'>
): string
```

### When to use

Use when you need a JSON string directly — HTTP response bodies, log records, message queue payloads. `dumpJson` is equivalent to `JSON.stringify(jt.dump(schemaId, value, { mode: 'json', ...options }))`.

### Examples

#### Example 1: Serialize a customer for an HTTP response

```ts
const customer = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

const json = jt.dumpJson(CustomerSchema.$id, customer);
// '{"id":"c1a2b3d4-...","email":"alice@bookstore.example","name":"Alice Chen","addresses":[]}'

// In an Express handler:
res.type('application/json').send(json);
```

#### Example 2: Serialize an order excluding defaults

```ts
const json = jt.dumpJson(OrderSchema.$id, order, { excludeDefaults: true });
// JSON string without currency: 'USD' (the default)
```

#### Example 3: Transform integration — Date fields encoded automatically

If the `OrderSchema.placedAt` field has a `Transform` decoder registered (see [Transforms](/transforms)), `dumpJson` applies the `encode` function when walking the graph. A `coerce()` → `dumpJson()` round-trip recovers the original wire value.

```ts
import { Transform } from 'json-tology';

const PlacedAtSchema = Transform.create(
  { $id: 'https://bookstore.example/PlacedAt', type: 'string', format: 'date-time' } as const,
  { decode: (s: string) => new Date(s), encode: (d: Date) => d.toISOString() },
);

// After registering and coercing — placedAt is a Date object in domain layer
// dumpJson encodes it back to ISO string automatically
```

### Comparison

::: code-group

```ts [json-tology]
const json = jt.dumpJson(OrderSchema.$id, order);
// Transform encoders applied, Date → ISO string, returns string
```

```ts [Zod]
// JSON.stringify directly — no built-in equivalent.
const json = JSON.stringify(order);
// Date objects must be converted manually before stringify.
```

```ts [TypeBox]
// JSON.stringify directly.
const json = JSON.stringify(order);
```

```ts [AJV]
// JSON.stringify directly.
const json = JSON.stringify(order);
```

```py [Pydantic]
json_str = order.model_dump_json()
# Equivalent — serializes datetime fields to ISO string automatically
json_str = order.model_dump_json(exclude_defaults=True)
```

:::

### Related

- `dump` — return JS object instead of string; more flexible options
- [Transforms](/transforms) — how `encode` functions are registered and applied
