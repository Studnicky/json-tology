# `Operations.clone` and `Hash.value`

Pure static utilities that work on any value without a schema.

---

## `Operations.clone` {#operations-clone}

**Declaration.** Deep-copies a value using `structuredClone`. Returns an independent copy with no shared object references. Type-preserving - `clone<T>(v: T): T`.

**Use this when** you need an independent copy before passing a value to a mutating operation, or before `Value.diff` when you want to keep the original. `instantiate()` already clones internally; only call `clone` when doing your own mutation.

**Don't use this when** you just need a shallow copy (use `{ ...obj }` instead). Don't use it for non-JSON-serializable values (functions, class instances with methods - `structuredClone` may throw or strip those).

### Examples

#### Example 1: Clone an order before adding a line item

```ts
import { Operations } from 'json-tology/value';
import { bookstoreEntities, OrderSchema } from './bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      14.99,
  items:      [{ bookIsbn: '9783522128001', quantity: 1, unitPrice: 14.99 }],
});

const copy = Operations.clone(order);
(copy.items as Array<{ bookIsbn: string; quantity: number; unitPrice: number }>).push(
  { bookIsbn: '9783522115056', quantity: 1, unitPrice: 9.99 }
);

console.log(order.items.length); // 1  - original unchanged
console.log(copy.items.length);  // 2
```

#### Example 2: Clone nested addresses

```ts
const customer = jt.instantiate(CustomerSchema.$id, {
  id:        'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email:     'bastian.bux@bookstore.example',
  name:      'Bastian Balthazar Bux',
  addresses: [{ street: 'Reichenbachstraße 14', city: 'München', postalCode: '80538' }],
});

const copy = Operations.clone(customer);
console.log(copy.addresses === customer.addresses); // false  - deep copy
```

### Comparison

::: code-group

```ts [json-tology]
const copy = Operations.clone(order); // deep copy via structuredClone
```

```ts [Zod]
// No built-in clone utility.
const copy = structuredClone(order);
```

```ts [Valibot]
// Limitation: Valibot has no clone utility - use structuredClone.
const copy = structuredClone(order);
```

```ts [io-ts]
// Limitation: io-ts has no clone utility - use structuredClone.
const copy = structuredClone(order);
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
const copy = Value.Clone(order);
```

```ts [AJV]
// No built-in clone  - use structuredClone.
const copy = structuredClone(order);
```

```py [Pydantic]
copy = order.model_copy(deep=True)
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

---

## `Hash.value` {#hash-value}

**Declaration.** Computes a deterministic FNV-1a hash of a JSON-serializable value. Property key order is normalized before hashing - two objects with the same keys/values but different key order produce identical hashes. Returns a hex string. Not cryptographically secure.

**Use this when** you need content-addressable caching, deduplication, ETag generation, or change detection without a full structural diff.

**Don't use this when** you need cryptographic security - this is not a secure hash. Don't use it for values that contain non-JSON-serializable data (functions, undefined, circular references - behavior is undefined).

### Examples

#### Example 1: Generate an ETag for a book

```ts
import { Hash } from 'json-tology/value';

const book = jt.instantiate(BookSchema.$id, {
  isbn:    '9783522128001',
  title:   'Die unendliche Geschichte',
  authors: ['Michael Ende'],
  price:   14.99,
});

const etag = Hash.value(book);
// deterministic hex string  - same value each time, key order independent

const h1 = Hash.value({ isbn: '9783522128001', title: 'Die unendliche Geschichte' });
const h2 = Hash.value({ title: 'Die unendliche Geschichte', isbn: '9783522128001' });
console.log(h1 === h2); // true  - key order doesn't matter
```

#### Example 2: Cache invalidation

```ts
const prevHash = Hash.value(order);
// ... order is updated ...
const newOrder = jt.instantiate(OrderSchema.$id, { ...order, total: 27.98 });

if (Hash.value(newOrder) !== prevHash) {
  invalidateCache(order.id);
}
```

### Comparison

::: code-group

```ts [json-tology]
Hash.value(book) // deterministic FNV-1a hex, key-order invariant
```

```ts [Zod]
// No built-in hash utility.
// Use a third-party library: object-hash, stable-hash, etc.
import hash from 'object-hash';
const h = hash(book);
```

```ts [Valibot]
// Limitation: Valibot has no hash utility.
// Use a third-party library: object-hash, stable-hash, etc.
import hash from 'object-hash';
const h = hash(book);
```

```ts [io-ts]
// Limitation: io-ts has no hash utility.
// Use a third-party library: object-hash, stable-hash, etc.
import hash from 'object-hash';
const h = hash(book);
```

```ts [TypeBox + Value]
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

- [`Value.diff`](/value/diff) - compute structural differences between two values
- [`Operations.clone`](#operations-clone) - deep copy before mutation or diffing

## See also

- [Bookstore domain](/bookstore-domain) - where `Order`, `Book`, `Customer` are defined
