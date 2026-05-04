# `Value.diff` and `Value.applyOp`

---

## `Value.diff` {#value-diff}

**Declaration.** Computes the structural diff between two values and returns a `Changeset`. The changeset contains an ordered list of JSON Pointer–based operations (`set` / `delete`) that transform `before` into `after`. Returns `Changeset` with `.isEmpty`, `.length`, `.operations` (readonly array of `DiffOpType`). Does not mutate either input.

**Use this when** you need event sourcing, audit logs, optimistic concurrency checks, undo/redo, or detecting whether two values differ without a full deep-equal check.

**Don't use this when** you only need a boolean "are these equal?" check — `Value.hash(a) === Value.hash(b)` is faster for equality. Don't use it inside tight inner loops — it walks both objects recursively.

### Examples

#### Example 1: Detect email change on a customer update

```ts
import { Value } from 'json-tology';
import { bookstoreJt, CustomerSchema } from './bookstore/index.js';

const before = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

const after = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice.chen@bookstore.example', // changed
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
const beforeOrder = jt.coerce(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      14.99,
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 14.99 }],
});

const afterOrder = jt.coerce(OrderSchema.$id, {
  ...beforeOrder,
  items: [
    ...beforeOrder.items,
    { bookIsbn: '9780062316110', quantity: 1, unitPrice: 9.99 },
  ],
  total: 24.98,
});

const changes = Value.diff(beforeOrder, afterOrder);
// operations: [{ op: 'set', path: '/items/1', value: {...} }, { op: 'set', path: '/total', value: 24.98 }]
```

#### Example 3: Audit log entry

```ts
function auditUpdate(schemaId: string, before: unknown, after: unknown) {
  const changes = Value.diff(before, after);
  if (!changes.isEmpty) {
    logger.info('record.updated', {
      count:  changes.length,
      ops:    changes.operations,
      schema: schemaId,
    });
  }
  return changes;
}
```

### Comparison

::: code-group

```ts [json-tology]
const changes = Value.diff(before, after);
// Changeset — .isEmpty, .length, .operations (JSON Pointer paths)
```

```ts [Zod]
// Not built in — use a third-party library like microdiff, deep-diff, etc.
import { diff } from 'microdiff';
const changes = diff(before, after);
```

```ts [TypeBox + Value]
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
# Or use python-deepdiff for a full diff.
```

:::

---

## `Value.applyOp` {#value-applyop}

**Declaration.** Applies a single `DiffOpType` operation (`{ op: 'set', path: string, value: unknown }` or `{ op: 'delete', path: string }`) to a value and returns the result. The path is a JSON Pointer string. Does not mutate the input — clone it first if you need the original.

**Use this when** you want to apply specific operations from a changeset rather than all of them — for example, rolling back one field change in an undo system, or applying real-time patch updates one at a time.

**Don't use this when** you want to apply all operations at once — use `changeset.apply(value)` (or loop over `changeset.operations` and call `Value.applyOp` yourself — see the note about `Changeset.apply` below).

::: tip Note on Changeset.apply

The project lint rules block direct calls to methods named `.apply()` (to prevent accidental use of `Function.prototype.apply`). To apply a full changeset, loop over `.operations` manually:

```ts
let result: unknown = Value.clone(before);
for (const op of changes.operations) {
  result = Value.applyOp(result, op);
}
```

:::

### Examples

#### Example 1: Apply a single price update

```ts
import { Value } from 'json-tology';

const book = jt.coerce(BookSchema.$id, {
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
console.log((updated as typeof book).price); // 12.99
console.log(book.price);                      // 14.99 — original unchanged
```

### Comparison

::: code-group

```ts [json-tology]
const result = Value.applyOp(Value.clone(book), { op: 'set', path: '/price', value: 12.99 });
```

```ts [Zod]
// Not built in — use fast-json-patch for JSON Patch operations:
import { applyOperation } from 'fast-json-patch';
const result = applyOperation(clone, { op: 'replace', path: '/price', value: 12.99 }).newDocument;
```

```ts [TypeBox + Value]
// Not built in.
```

```ts [AJV]
// Not built in.
```

```py [Pydantic]
updated = book.model_copy(update={'price': 12.99})
```

:::

## Related

- [`Value.clone`](/value/clone-hash#value-clone) — clone before applying to preserve original
- [`Value.diff`](#value-diff) — produce the operations to apply

## See also

- [Bookstore domain](/bookstore-domain) — where `Book`, `Customer`, `Order` are defined
