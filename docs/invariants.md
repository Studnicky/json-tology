# Invariants

Invariants are cross-field validation rules that run **after** individual field validation succeeds. They are the equivalent of Pydantic's `@model_validator(mode='after')` for json-tology schemas.

## When to use

Use invariants when a constraint spans multiple fields and cannot be expressed as a single-field JSON Schema keyword. Examples:

- An order `total` must equal `sum(items[].price * items[].qty)`
- A date range must have `startDate <= endDate`
- A discriminated union property must be consistent with other fields

## Registering at construction time

Pass an `invariants` map to `JsonTology.create`. Keys are schema `$id` strings.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [OrderItemSchema, OrderSchema] as const,
  invariants: {
    'https://example.com/Order': [
      {
        name: 'totalMatchesItems',
        fn: (order) => {
          const typed = order as Order;
          const computed = typed.items.reduce(
            (sum, item) => sum + item.price * item.qty,
            0
          );
          return typed.total === computed
            ? null
            : 'total must equal sum(items[].price * items[].qty)';
        },
      },
    ],
  },
});
```

## Imperative registration

Add or remove invariants after construction:

```ts
jt.addInvariant<Order>('https://example.com/Order', {
  name: 'hasItems',
  fn: (order) => order.items.length > 0 ? null : 'order must have at least one item',
});

jt.removeInvariant('https://example.com/Order', 'hasItems');
```

## Error location

Supply an optional `pointer` (JSON Pointer string) to pin the error to a specific field:

```ts
jt.addInvariant('https://example.com/Order', {
  name: 'totalMatchesItems',
  pointer: '/total',
  fn: (order) => { /* ... */ },
});
// Error path will be '/total' instead of '' (root)
```

## Behaviour across the API

| Method | Invariant behaviour |
|--------|---------------------|
| `errors()` | Returns invariant failures as `ValidationErrorType` items with `keyword: 'jt:invariant'` |
| `coerce()` | Throws `CoercionError` when any invariant fails |
| `is()` | Returns `false` when any invariant fails |
| `validate()` | Includes invariant failure messages in the string array |

Invariants **do not run** when structural validation already failed. This prevents noise from cascading errors on malformed input.
