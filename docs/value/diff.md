# `Value.diff` and `Operations.patch`

---

## Changeset {#changeset}

A `Changeset` is the result type returned by `Value.diff`. It holds an ordered list of JSON Pointer-based operations (`set` / `delete`) that transform one value into another. Key members:

- `.isEmpty`: `true` when no operations were produced
- `.length`: number of operations in the changeset
- `.operations`: readonly array of `DiffOpType` (`{ op: 'set', path: string, value: unknown }` or `{ op: 'delete', path: string }`)

See [`Value.diff`](#value-diff) for usage examples and [`Operations.patch`](#operations-patch) for applying individual operations.

---

## `Value.diff` {#value-diff}

**Declaration.** Computes the structural diff between two values and returns a `Changeset`. The changeset contains an ordered list of JSON Pointer-based operations (`set` / `delete`) that transform `before` into `after`. Returns `Changeset` with `.isEmpty`, `.length`, `.operations` (readonly array of `DiffOpType`). Does not mutate either input.

**Use this when** you need event sourcing, audit logs, optimistic concurrency checks, undo/redo, or detecting whether two values differ without a full deep-equal check.

**Don't use this when** you only need a boolean "are these equal?" check - `Hash.value(a) === Hash.value(b)` is faster for equality. Don't use it inside tight inner loops - it walks both objects recursively.

### Examples

#### Example 1: Detect email change on a customer update

<<< ../../examples/docs/value/02-diff.ts

#### Example 2: Track order line additions

```ts
const beforeOrder = jt.instantiate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      14.99,
  items:      [{ bookIsbn: '9783522128001', quantity: 1, unitPrice: 14.99 }],
});

const afterOrder = jt.instantiate(OrderSchema.$id, {
  ...beforeOrder,
  items: [
    ...beforeOrder.items,
    { bookIsbn: '9783522115056', quantity: 1, unitPrice: 9.99 },
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
// Changeset  - .isEmpty, .length, .operations (JSON Pointer paths)
```

```ts [Zod]
// Zod has no built-in diff. Use a third-party library:
import { diff } from 'microdiff';
const changes = diff(before, after);
// Limitation: microdiff paths use bracket notation, not JSON Pointer; no typed Changeset;
// no built-in `applyOp` - you need fast-json-patch or manual object mutation.
```

```ts [Valibot]
// Limitation: Valibot has no diff utility. Use a third-party library:
import { diff } from 'microdiff';
const changes = diff(before, after);
// No typed Changeset, no JSON Pointer paths, no schema awareness.
```

```ts [io-ts]
// Limitation: io-ts has no diff utility. Use a third-party library:
import { diff } from 'microdiff';
const changes = diff(before, after);
// No typed Changeset, no JSON Pointer paths, no schema awareness.
```

```ts [TypeBox + Value]
// TypeBox has no built-in diff.
// Closest: implement manually over Value.Errors or with a deep-diff library.
// Limitation: no standard diff API; output format is library-specific;
// no composable `applyOp` complement.

```

```ts [AJV]
// AJV has no built-in diff.
// Use a third-party library (microdiff, deep-diff) applied after validation.
// Limitation: same as TypeBox - no Changeset, no JSON Pointer paths, no applyOp.
```

```py [Pydantic]
# Manual dict comparison:
before_dict = before.model_dump()
after_dict  = after.model_dump()
changes = {k: v for k, v in after_dict.items() if before_dict.get(k) != v}
# Or use python-deepdiff for a full diff.
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

## `Operations.patch` {#operations-patch}

**Declaration.** Applies a single `DiffOpType` operation (`{ op: 'set', path: string, value: unknown }` or `{ op: 'delete', path: string }`) to a value and returns the result. The path is a JSON Pointer string. Does not mutate the input - clone it first if you need the original.

**Use this when** you want to apply specific operations from a changeset rather than all of them - for example, rolling back one field change in an undo system, or applying real-time patch updates one at a time.

**Don't use this when** you want to apply all operations at once - use `changeset.apply(value)` (or loop over `changeset.operations` and call `Operations.patch` yourself - see the note about `Changeset.apply` below).

::: tip Note on Changeset.apply

The project lint rules block direct calls to methods named `.apply()` (to prevent accidental use of `Function.prototype.apply`). To apply a full changeset, loop over `.operations` manually:

```ts
import { Operations } from 'json-tology/value';

let result: unknown = Operations.clone(before);
for (const op of changes.operations) {
  result = Operations.patch(result, op);
}
```

:::

### Examples

#### Example 1: Apply a single price update

```ts
import { Operations } from 'json-tology/value';

const book = jt.instantiate(BookSchema.$id, {
  isbn:    '9783522128001',
  title:   'Die unendliche Geschichte',
  authors: ['Michael Ende'],
  price:   14.99,
});

const updated = Operations.patch(Operations.clone(book), {
  op:    'set',
  path:  '/price',
  value: 12.99,
});
console.log((updated as typeof book).price); // 12.99
console.log(book.price);                      // 14.99  - original unchanged
```

### Comparison

::: code-group

```ts [json-tology]
const result = Operations.patch(Operations.clone(book), { op: 'set', path: '/price', value: 12.99 });
```

```ts [Zod]
// Zod has no built-in patch. Use fast-json-patch:
import { applyOperation } from 'fast-json-patch';
const result = applyOperation(clone, { op: 'replace', path: '/price', value: 12.99 }).newDocument;
// Limitation: fast-json-patch uses JSON Patch format (op: 'replace'), not the
// json-tology DiffOpType (op: 'set'). Requires an extra dependency; no type narrowing.
```

```ts [Valibot]
// Limitation: Valibot has no patch utility. Use fast-json-patch:
import { applyOperation } from 'fast-json-patch';
const result = applyOperation(clone, { op: 'replace', path: '/price', value: 12.99 }).newDocument;
// Same constraints as Zod - JSON Patch format, extra dependency, no schema awareness.
```

```ts [io-ts]
// Limitation: io-ts has no patch utility. Use fast-json-patch:
import { applyOperation } from 'fast-json-patch';
const result = applyOperation(clone, { op: 'replace', path: '/price', value: 12.99 }).newDocument;
// JSON Patch format, extra dependency, no schema-aware mutation.
```

```ts [TypeBox + Value]
// TypeBox has no built-in diff.
// Closest: implement manually over Value.Errors or with a deep-diff library.
// Limitation: no standard diff API; output format is library-specific;
// no composable patch complement.

```

```ts [AJV]
// AJV has no built-in diff.
// Use a third-party library (microdiff, deep-diff) applied after validation.
// Limitation: same as TypeBox - no Changeset, no JSON Pointer paths, no patch.
```

```py [Pydantic]
updated = book.model_copy(update={'price': 12.99})
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

- [`Operations.clone`](/value/clone-hash#operations-clone) - clone before applying to preserve original
- [`Value.diff`](#value-diff) - produce the operations to apply

## See also

- [Bookstore domain](/bookstore-domain) - where `Book`, `Customer`, `Order` are defined
