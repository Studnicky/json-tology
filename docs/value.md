# Value Operations

> This guide covers `Value.clone`, `Value.hash`, `Value.diff`, `Value.applyOp`, `jt.value.cast`, `clean`, `convert`, `create`, `coerce`, and `Changeset`. All examples use the [bookstore domain](/bookstore-domain). See [Validation](/validation) for how `coerce` works at the `jt` facade level.

`Value` provides two kinds of operations:

- **Static** — pure functions that work on any value without a schema: `clone`, `hash`, `diff`, `applyOp`
- **Instance** — schema-aware operations that delegate to the registry: `cast`, `clean`, `convert`, `create`, `coerce`

Access the schema-aware operations via `jt.value.*` or construct a `Value` instance with a `SchemaRegistry` directly.

---

## Value.clone

Deep-copies a value using `structuredClone`.

### Signature

```ts
public static clone<T extends unknown>(value: T): T
```

### When to use

Use before passing data to `coerce()` or any mutating operation when you need to preserve the original. `coerce()` clones internally — you only need `clone()` when you want to preserve your reference before passing it elsewhere.

### Examples

#### Example 1: Clone an order before modifying

```ts
import { Value } from 'json-tology';

const original: Order = jt.coerce(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      14.99,
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 14.99 }],
});

const copy = Value.clone(original);
(copy.items as OrderLine[]).push({ bookIsbn: '9780062316110', quantity: 1, unitPrice: 9.99 });

console.log(original.items.length); // 1 — original unchanged
console.log(copy.items.length);     // 2
```

#### Example 2: Clone nested addresses array

```ts
const customer: Customer = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
  addresses: [{ street: '12 Elm Lane', city: 'Bookham', postalCode: '94107' }],
});

const copy = Value.clone(customer);
console.log(copy.addresses === customer.addresses); // false — deep copy
```

### Comparison

::: code-group

```ts [json-tology]
import { Value } from 'json-tology';
const copy = Value.clone(order);
```

```ts [Zod]
// No dedicated clone utility — use structuredClone directly.
const copy = structuredClone(order);
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
const copy = Value.Clone(order);
```

```ts [AJV]
// No built-in — use structuredClone.
const copy = structuredClone(order);
```

```py [Pydantic]
import copy
order_copy = copy.deepcopy(order)
# Or: order.model_copy(deep=True)
```

:::

### Related

- `Value.diff` — compute the changeset between two values
- `Value.applyOp` — apply a single diff operation

---

## Value.hash

Computes a deterministic FNV-1a hash of a JSON-serializable value. Key order is normalized before hashing.

### Signature

```ts
public static hash(value: unknown): string
```

Returns a hex string. Key order does not affect the result.

### When to use

Use for content-addressable caching, deduplication, ETag generation, or change detection in systems where you want to avoid a full structural diff. Not cryptographically secure — do not use for security purposes.

### Examples

#### Example 1: Generate an ETag for a book

```ts
const book: Book = jt.coerce(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});

const etag = Value.hash(book);
console.log(etag); // deterministic hex string

// Key order doesn't matter:
const h1 = Value.hash({ isbn: '9780140449136', title: 'Crime and Punishment' });
const h2 = Value.hash({ title: 'Crime and Punishment', isbn: '9780140449136' });
console.log(h1 === h2); // true
```

#### Example 2: Cache invalidation for order total

```ts
const prevHash = Value.hash(order);

// ... order is updated ...
const newOrder = jt.coerce(OrderSchema.$id, { ...order, total: 27.98 });
const newHash = Value.hash(newOrder);

if (prevHash !== newHash) {
  invalidateCache(order.id);
}
```

### Comparison

::: code-group

```ts [json-tology]
import { Value } from 'json-tology';
const hash = Value.hash(book); // deterministic FNV-1a hex
```

```ts [Zod]
// No built-in hash utility.
// Use a third-party library: object-hash, stable-hash, etc.
import hash from 'object-hash';
const h = hash(book);
```

```ts [TypeBox]
// No built-in hash utility.
```

```ts [AJV]
// No built-in hash utility.
```

```py [Pydantic]
import hashlib, json
data = book.model_dump()
h = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
```

:::

### Related

- `Value.diff` — compute structural differences between two values
- `Value.clone` — copy before hashing to avoid mutation issues

---

## Value.diff

Computes the structural diff between two values as a `Changeset`.

### Signature

```ts
public static diff(before: unknown, after: unknown): Changeset
```

Returns a `Changeset` with `operations` (array of `DiffOpType`), `isEmpty`, and `length`. Call `changeset.apply(before)` to replay the operations.

### When to use

Use for event sourcing, audit logs, optimistic updates, or undo/redo. The changeset is a JSON-serializable list of JSON Pointer–based `set` / `delete` operations.

### Examples

#### Example 1: Detect changes to a customer profile

```ts
const before: Customer = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

const after: Customer = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice.chen@bookstore.example',  // changed
  name:  'Alice Chen',
});

const changes = Value.diff(before, after);

console.log(changes.isEmpty);   // false
console.log(changes.length);    // 1
console.log(changes.operations);
// [{ op: 'set', path: '/email', value: 'alice.chen@bookstore.example' }]
```

#### Example 2: Track order line additions

```ts
const beforeOrder: Order = { ...order };
const afterOrder: Order = jt.coerce(OrderSchema.$id, {
  ...order,
  items: [
    ...order.items,
    { bookIsbn: '9780062316110', quantity: 1, unitPrice: 9.99 },
  ],
  total: order.total + 9.99,
});

const changes = Value.diff(beforeOrder, afterOrder);
console.log(changes.operations);
// [
//   { op: 'set', path: '/items/1', value: { bookIsbn: '...', quantity: 1, unitPrice: 9.99 } },
//   { op: 'set', path: '/total', value: 24.98 },
// ]

// Replay to reconstruct afterOrder from beforeOrder:
const reconstructed = changes.apply(beforeOrder);
console.log(reconstructed.total); // 24.98
```

#### Example 3: Audit log entry

```ts
function auditUpdate(schemaId: string, before: unknown, after: unknown) {
  const changes = Value.diff(before, after);
  if (!changes.isEmpty) {
    logger.info('record.updated', {
      schema: schemaId,
      ops:    changes.operations,
      count:  changes.length,
    });
  }
  return changes;
}
```

### Comparison

::: code-group

```ts [json-tology]
import { Value } from 'json-tology';
const changes = Value.diff(before, after);
// Changeset — .isEmpty, .length, .operations, .apply(before)
```

```ts [Zod]
// Not built in — use a third-party library like microdiff or deep-diff.
import { diff } from 'deep-diff';
const changes = diff(before, after);
```

```ts [TypeBox]
// Not built in.
```

```ts [AJV]
// Not built in.
```

```py [Pydantic]
# Manual dict comparison:
before_dict = before.model_dump()
after_dict  = after.model_dump()
changes = {k: v for k, v in after_dict.items() if before_dict.get(k) != v}
# Or use jsondiff / deepdiff libraries.
```

:::

### Related

- `Value.applyOp` — apply a single `DiffOpType` operation
- `Changeset.apply` — replay all operations onto a value
- `Value.clone` — clone before applying changes if you need to keep the original

---

## Value.applyOp

Applies a single diff operation to a value and returns the result.

### Signature

```ts
static applyOp(root: unknown, operation: DiffOpType): unknown
```

### When to use

Use when you want to apply one specific operation from a changeset — for example, rolling back only one field change in an undo system, or applying real-time patch updates one at a time.

### Examples

#### Example 1: Apply a targeted price update

```ts
import { Value } from 'json-tology';

const book: Book = jt.coerce(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});

const updated = Value.applyOp(Value.clone(book), {
  op:    'set',
  path:  '/price',
  value: 12.99,
});
console.log((updated as Book).price); // 12.99
console.log(book.price);              // 14.99 — original unchanged
```

### Comparison

::: code-group

```ts [json-tology]
const result = Value.applyOp(Value.clone(book), { op: 'set', path: '/price', value: 12.99 });
```

```ts [Zod]
// Not directly supported — use a JSON Patch library (fast-json-patch, etc.)
import { applyOperation } from 'fast-json-patch';
const result = applyOperation(clone, { op: 'replace', path: '/price', value: 12.99 }).newDocument;
```

```ts [TypeBox]
// Not built in.
```

```ts [AJV]
// Not built in.
```

```py [Pydantic]
updated = book.model_copy(update={'price': 12.99})
```

:::

---

## jt.value.cast

Coerces types (e.g., `"9.99"` → `9.99`) and fills defaults. Requires `castTypes: true` in the `JsonTology.create` options.

### Signature

```ts
public cast(schemaId: string, data: unknown): unknown
```

### When to use

Use when you're ingesting data from sources that serialize numbers and booleans as strings — CSV imports, URL query parameters, HTML form data. Enable `castTypes: true` globally or call `cast` explicitly.

### Examples

#### Example 1: Cast form input with numeric strings

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [BookSchema] as const,
  castTypes: true,
});

const book = jt.value.cast(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   '14.99',   // string — coerced to number
  inStock: 'true',    // string — coerced to boolean
});
// { isbn: '...', title: '...', authors: [...], price: 14.99, inStock: true, currency: 'USD' }
```

#### Example 2: Cast a review rating from URL param

```ts
const rawRating = req.query.rating; // '4' (string from query string)
const review = jt.value.cast(ReviewSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  bookIsbn:   '9780140449136',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  rating:     rawRating,
  body:       'Absolutely gripping from start to finish.',
  postedAt:   new Date().toISOString(),
});
console.log(review.rating); // 4 (number)
```

### Comparison

::: code-group

```ts [json-tology]
const jt = JsonTology.create({ ..., castTypes: true });
const book = jt.value.cast(BookSchema.$id, rawData); // strings coerced
```

```ts [Zod]
// Zod uses .coerce() wrappers per field:
const BookSchema = z.object({
  price:   z.coerce.number(),
  inStock: z.coerce.boolean(),
  // ...
});
const book = BookSchema.parse(rawData);
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
// TypeBox Value.Convert() coerces values:
const book = Value.Convert(BookSchema, rawData);
```

```ts [AJV]
// AJV has coerceTypes option:
const ajv = new Ajv({ coerceTypes: true });
ajv.validate(bookSchema, rawData); // rawData mutated in place
```

```py [Pydantic]
# Pydantic v2 uses strict=False (default) which coerces compatible types:
book = Book.model_validate(raw_data)  # '14.99' becomes 14.99
# Use strict=True to disable coercion.
```

:::

### Related

- `jt.coerce` — the top-level facade equivalent (always does cast + defaults + strip)
- `jt.value.convert` — coerce types only, no defaults

---

## jt.value.clean

Strips unknown properties from data according to the schema.

### Signature

```ts
public clean(schemaId: string, data: unknown): unknown
```

### When to use

Use when you want to remove extra fields from data that already passes validation — for example, sanitising a response from an external API before persisting it. `coerce()` does this automatically; `clean()` is for when you only need the strip step without applying defaults.

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
// unknown properties stripped, validation error thrown if invalid
```

```ts [Zod]
// Zod's .strip() mode (default) removes unknown keys during parse:
const cleaned = BookSchema.parse(data);
// .strict() mode throws on unknown keys instead.
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
// Value.Clean removes additional properties:
Value.Clean(BookSchema, Value.Clone(data));
```

```ts [AJV]
const ajv = new Ajv({ removeAdditional: true });
ajv.validate(bookSchema, data); // mutates data in place
```

```py [Pydantic]
# Pydantic ignores extra fields by default (extra='ignore').
# Use model_config = ConfigDict(extra='forbid') to raise on extras.
cleaned = Book.model_validate(data)
```

:::

---

## jt.value.convert

Coerces types without applying schema defaults.

### Signature

```ts
public convert(schemaId: string, data: unknown): unknown
```

### When to use

Use when you need type coercion (string → number, etc.) but explicitly want to control which defaults are applied separately. Contrast with `cast()` which applies both type coercion and defaults.

### Examples

#### Example 1: Convert types for a review without filling defaults

```ts
const converted = jt.value.convert(ReviewSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  bookIsbn:   '9780140449136',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  rating:     '5',    // coerced to number
  body:       'One of the greatest novels ever written.',
  postedAt:   '2026-01-15T10:30:00Z',
});
console.log(converted.rating); // 5 (number)
```

---

## jt.value.create

Synthesizes a zero-value default instance for a schema — `''` for strings, `0` for numbers, `false` for booleans, explicit defaults where declared.

### Signature

```ts
public create(schemaId: string): unknown
```

### When to use

Use when you need a blank object that structurally matches a schema for form initialization or testing. Contrast with `materialize()` which takes partial input and fills only the gap fields.

### Examples

#### Example 1: Create a blank Book form state

```ts
const blank = jt.value.create(BookSchema.$id);
console.log(blank);
// {
//   isbn:     '',          // zero-value for string (no default)
//   title:    '',          // zero-value for string
//   authors:  [],          // zero-value for array
//   price:    0,           // zero-value for number
//   currency: 'USD',       // explicit default
//   inStock:  true,        // explicit default
// }
```

#### Example 2: Create a blank Order for testing

```ts
const blankOrder = jt.value.create(OrderSchema.$id);
// {
//   id:         '',
//   customerId: '',
//   items:      [],
//   total:      0,
//   currency:   'USD',
//   placedAt:   '',
// }
```

### Comparison

::: code-group

```ts [json-tology]
const blank = jt.value.create(BookSchema.$id);
// Zero-values + explicit defaults
```

```ts [Zod]
// Zod doesn't provide a zero-value creator.
// Closest: schema.parse({}) — fails if required fields are missing.
// Use defaulted schemas: z.object({ isbn: z.string().default(''), ... })
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
// Value.Create fills with type defaults + explicit defaults:
const blank = Value.Create(BookSchema);
```

```ts [AJV]
// Not directly supported — AJV doesn't generate default instances.
```

```py [Pydantic]
# Pydantic requires values for required fields — no zero-value creation built in.
# Use create_model with all optional fields, or supply explicit defaults:
Book(isbn='', title='', authors=[], price=0)
```

:::

### Related

- `materialize` — build from partial data with declared defaults
- `Compose.getDefaults` — extract only the declared `default` values (no zero-values)
