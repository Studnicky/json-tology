# Cross-field Invariants

> This guide covers `addInvariant` and `removeInvariant`. All examples use the [bookstore domain](/bookstore-domain). See [Computed Fields](/computed) for derived values; see [Validation](/validation#coerce) for how invariants integrate with `coerce`, `errors`, `is`, and `validate`.

Invariants are cross-field validation rules that run **after** structural validation succeeds. They are json-tology's equivalent of Pydantic's `@model_validator(mode='after')`. Use them when a constraint spans multiple fields and cannot be expressed as a single-field JSON Schema keyword.

---

## addInvariant

Registers a cross-field invariant for a schema.

### Signature

```ts
public addInvariant<T = unknown>(
  schemaId: string,
  invariant: InvariantInterface<T>
): void
```

`InvariantInterface<T>` requires:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique identifier for this invariant |
| `fn` | `(data: T) => string \| null` | Yes | Returns an error message string on failure, `null` on success |
| `pointer` | `string` | No | JSON Pointer to pin the error to a specific field path |

### When to use

Use invariants for business rules that involve two or more fields:
- `total` must equal `sum(items[].unitPrice * quantity)`
- A review `rating` of 5 requires `body` of at least 50 characters
- `placedAt` cannot be in the future

Invariants **do not run** when structural validation already failed — preventing noise from cascading errors on malformed input.

### Examples

#### Example 1: Order total must match line items

Building on `OrderSchema` and `OrderLineSchema` from the [bookstore domain](/bookstore-domain).

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology';

type Order = InferType<typeof OrderSchema>;

// Register at construction time:
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [OrderLineSchema, OrderSchema] as const,
  invariants: {
    'https://bookstore.example/Order': [
      {
        name: 'totalMatchesItems',
        pointer: '/total',
        fn: (order) => {
          const typed = order as Order;
          const computed = typed.items.reduce(
            (sum, item) => sum + (item as { unitPrice: number; quantity: number }).unitPrice
              * (item as { unitPrice: number; quantity: number }).quantity,
            0
          );
          // Allow floating-point rounding tolerance
          return Math.abs(typed.total - computed) < 0.01
            ? null
            : `total must equal sum of items (expected ${computed.toFixed(2)}, got ${typed.total})`;
        },
      },
    ],
  },
});
```

#### Example 2: Invariant failure surfaces in errors() and coerce()

```ts
const invalidOrder = {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      99.00,   // wrong — items sum to 14.99
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 14.99 }],
};

// errors() includes the invariant failure
const errs = jt.errors(OrderSchema.$id, invalidOrder);
console.log(errs.ok);      // false
console.log(errs.length);  // 1
for (const err of errs) {
  console.log(err.path);    // '/total' (from the pointer)
  console.log(err.keyword); // 'jt:invariant'
  console.log(err.message); // 'total must equal sum of items (expected 14.99, got 99)'
}

// coerce() throws CoercionError
try {
  jt.coerce(OrderSchema.$id, invalidOrder);
} catch (err) {
  console.log(err.constructor.name); // 'CoercionError'
}

// is() returns false
console.log(jt.is(OrderSchema.$id, invalidOrder)); // false

// validate() includes the message
console.log(jt.validate(OrderSchema.$id, invalidOrder));
// ['/total: total must equal sum of items (expected 14.99, got 99)']
```

#### Example 3: Imperative registration — add after construction

```ts
import type { InferType } from 'json-tology';

type Review = InferType<typeof ReviewSchema>;

jt.addInvariant<Review>('https://bookstore.example/Review', {
  name:    'highRatingRequiresDetailedReview',
  pointer: '/body',
  fn: (review) => {
    if (review.rating === 5 && review.body.length < 50) {
      return '5-star reviews must have a body of at least 50 characters';
    }
    return null;
  },
});
```

#### Example 4: Multiple invariants on one schema

```ts
jt.addInvariant<Order>('https://bookstore.example/Order', {
  name: 'totalIsPositive',
  fn: (order) => order.total > 0 ? null : 'order total must be positive',
});

jt.addInvariant<Order>('https://bookstore.example/Order', {
  name: 'hasAtLeastOneItem',
  fn: (order) => order.items.length > 0 ? null : 'order must have at least one item',
});

// All registered invariants run in sequence after structural validation
```

### Behaviour table

| Method | Invariant behaviour |
|--------|---------------------|
| `errors()` | Returns invariant failures as `ValidationErrorType` items with `keyword: 'jt:invariant'` |
| `coerce()` | Throws `CoercionError` when any invariant fails |
| `is()` | Returns `false` when any invariant fails |
| `validate()` | Includes invariant failure messages in the string array |

Invariants do not run when structural validation already failed (missing required fields, wrong types, etc.) — this prevents noise from cascading errors.

### Comparison

::: code-group

```ts [json-tology]
jt.addInvariant<Order>('https://bookstore.example/Order', {
  name:    'totalMatchesItems',
  pointer: '/total',
  fn: (order) => {
    const computed = order.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return Math.abs(order.total - computed) < 0.01 ? null : 'total mismatch';
  },
});
```

```ts [Zod]
// Zod uses .superRefine() or .refine() for cross-field validation:
const OrderSchema = z.object({ ... }).refine(
  (order) => {
    const computed = order.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return Math.abs(order.total - computed) < 0.01;
  },
  { message: 'total mismatch', path: ['total'] }
);
```

```ts [TypeBox]
// Not directly supported as a first-class concept.
// Apply cross-field validation manually after Type validation:
if (!Check(OrderSchema, data)) throw new Error('invalid');
const computed = data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
if (Math.abs(data.total - computed) >= 0.01) throw new Error('total mismatch');
```

```ts [AJV]
// Not directly supported — AJV validates JSON Schema keywords only.
// Apply cross-field checks manually after ajv.validate():
const valid = ajv.validate(orderSchema, data);
if (valid) {
  const computed = data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (Math.abs(data.total - computed) >= 0.01) { /* handle error */ }
}
```

```py [Pydantic]
from pydantic import BaseModel, model_validator

class Order(BaseModel):
    items: list[OrderLine]
    total: float

    @model_validator(mode='after')
    def total_matches_items(self) -> 'Order':
        computed = sum(l.unit_price * l.quantity for l in self.items)
        if abs(self.total - computed) >= 0.01:
            raise ValueError(f'total mismatch: expected {computed:.2f}')
        return self
```

:::

### Related

- `removeInvariant` — deregister an invariant by name
- [Computed Fields](/computed) — derive field values from other fields (complements invariants)
- [Validation](/validation) — how invariant failures appear in `errors()`, `validate()`, and `CoercionError`

---

## removeInvariant

Removes a previously registered invariant by name.

### Signature

```ts
public removeInvariant(schemaId: string, name: string): void
```

### When to use

Use when business rules change at runtime — for example, when a promotional period removes the minimum review length requirement, or when A/B testing different validation strictness levels.

### Examples

#### Example 1: Remove an invariant by name

```ts
// Register
jt.addInvariant('https://bookstore.example/Review', {
  name: 'highRatingRequiresDetailedReview',
  fn: (review) => {
    const r = review as { rating: number; body: string };
    return r.rating === 5 && r.body.length < 50
      ? '5-star reviews must have a body of at least 50 characters'
      : null;
  },
});

// Remove (e.g. during a promotional event with relaxed requirements)
jt.removeInvariant('https://bookstore.example/Review', 'highRatingRequiresDetailedReview');
```

### Related

- `addInvariant` — register the invariant
