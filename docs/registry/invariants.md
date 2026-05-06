# `addInvariant` and `removeInvariant`

Invariants are cross-field validation rules that run after structural validation succeeds - the json-tology equivalent of Pydantic's `@model_validator(mode='after')`. They integrate with `validate()`, `instantiate()`, and `is()`.

---

## `JsonTology.addInvariant` {#jsonntology-addinvariant}

**Declaration.** Registers an `InvariantInterface<T>` for the schema identified by `schemaId`. The invariant's `fn` function receives a fully structural-validated (clean, defaults-applied) object and returns `null` on success or an error message string on failure. An optional `pointer` JSON Pointer string pins the error to a specific field path. Invariants run in registration order after structural validation passes.

**Use this when** a business rule involves two or more fields and cannot be expressed as a single-field JSON Schema keyword. Examples: `total` must equal `sum(items[].unitPrice * quantity)`, a date range must have `start <= end`, a 5-star review requires a long body.

**Don't use this when** the constraint can be expressed as a single JSON Schema keyword (`minimum`, `maxLength`, `pattern`, etc.) - structural constraints are faster and run first. Don't confuse with computed fields - invariants *validate*, computed fields *derive*.

### Examples

#### Example 1: Order total must match line items

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';
import { OrderLineSchema, OrderSchema } from './bookstore/index.js';

type Order = InferType<typeof OrderSchema>;

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [OrderLineSchema, OrderSchema] as const,
  invariants: {
    'https://bookstore.example/Order': [
      {
        name:    'totalMatchesItems',
        pointer: '/total',   // error pinned to /total path
        fn: (order) => {
          const typed = order as Order;
          const computed = (typed.items as Array<{ unitPrice: number; quantity: number }>)
            .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
          return Math.abs(typed.total - computed) < 0.01
            ? null
            : `total must equal sum of items (expected ${computed.toFixed(2)}, got ${typed.total})`;
        },
      },
    ],
  },
});
```

#### Example 2: Invariant failure surfaces in validate(), instantiate(), is()

```ts
const badOrder = {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      99.00,   // wrong  - items sum to 14.99
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 14.99 }],
};

// validate()  - invariant failure as ValidationErrorType with keyword: 'jt:invariant'
const errs = entities.validate(OrderSchema.$id, badOrder);
console.log(errs.ok);                                            // false
console.log(errs.items.some(e => e.keyword === 'jt:invariant')); // true
console.log(errs.items.some(e => e.message.includes('total must equal'))); // true

// is()  - returns false when invariant fails
console.log(jt.is(OrderSchema.$id, badOrder));  // false

// instantiate()  - throws InstantiationError carrying the same ValidationErrors
try {
  jt.instantiate(OrderSchema.$id, badOrder);
} catch (err) {
  // err instanceof InstantiationError; err.errors is the ValidationErrors collection
}
```

#### Example 3: Imperative add after construction

```ts
import type { InferType } from 'json-tology/types';
import { ReviewSchema } from './bookstore/index.js';

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

### Behaviour table

| Method | Invariant behaviour |
|--------|---------------------|
| `validate()` | Returns invariant failures as `ValidationErrorType` items in the `ValidationErrors` collection with `keyword: 'jt:invariant'` |
| `instantiate()` | Throws `InstantiationError` when any invariant fails (the error carries `ValidationErrors` on `.errors`) |
| `is()` | Returns `false` when any invariant fails |
| `aggregate()` / `report()` | Both `ValidationErrors` views include invariant errors alongside structural errors |

Invariants do not run when structural validation already failed - this prevents noise from cascading errors.

### Bad examples - what NOT to do

#### Anti-pattern 1: Using an invariant for a constraint that JSON Schema can express

```ts
// ⊥ Don't do this  - JSON Schema already has minimum/maximum
jt.addInvariant(ReviewSchema.$id, {
  name: 'ratingRange',
  fn: (r) => (r as { rating: number }).rating >= 1 && (r as { rating: number }).rating <= 5
    ? null : 'rating out of range',
});

// ✓ Do this  - express the constraint in the schema itself
const ReviewSchema = {
  // ...
  properties: {
    rating: { type: 'integer', minimum: 1, maximum: 5 },
  },
};
```

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
const OrderSchema = baseOrderSchema.refine(
  (order) => Math.abs(order.total - order.items.reduce((s, l) => s + l.unit_price * l.quantity, 0)) < 0.01,
  { message: 'total mismatch', path: ['total'] }
);
```

```ts [Valibot]
import * as v from 'valibot';
const OrderSchema = v.pipe(
  baseOrderSchema,
  v.check(
    (order) => Math.abs(order.total - order.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0)) < 0.01,
    'total mismatch',
  ),
);
// Limitation: Valibot has no registry, so cross-field rules cannot be
// added or removed against a registered schema by name; rebuild the schema.
```

```ts [TypeBox + Value]
// Not a first-class concept  - apply manually after Type validation:
if (!Check(OrderSchema, data)) throw new Error('invalid structure');
const computed = data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
if (Math.abs(data.total - computed) >= 0.01) throw new Error('total mismatch');
```

```ts [AJV]
// Not built in  - manual cross-field check after ajv.validate().
```

```py [Pydantic]
from pydantic import model_validator

class Order(BaseModel):
    items: list[OrderLine]
    total: float

    @model_validator(mode='after')
    def total_matches_items(self) -> 'Order':
        computed = sum(l.unit_price * l.quantity for l in self.items)
        if abs(self.total - computed) >= 0.01:
            raise ValueError(f'total must equal sum of items')
        return self
```

:::

### Related

- [`removeInvariant`](#jsonntology-removeinvariant) - deregister by name
- [Computed fields](/registry/computed) - derive values (not validate)
- [`ValidationErrors`](/validation/errors) - how invariant failures appear in the structured collection

---

## `JsonTology.removeInvariant` {#jsonntology-removeinvariant}

**Declaration.** Removes the invariant with the given `name` from the schema identified by `schemaId`. After removal, subsequent calls to `instantiate()`, `validate()`, and `is()` will not run that invariant.

**Use this when** business rules change at runtime - promotional periods relaxing constraints, feature flags switching validation levels, or A/B testing different rule sets.

### Examples

#### Example 1: Remove a review length requirement during a promotion

```ts
// Register
jt.addInvariant('https://bookstore.example/Review', {
  name: 'highRatingRequiresDetailedReview',
  fn: (r) => {
    const review = r as { rating: number; body: string };
    return review.rating === 5 && review.body.length < 50
      ? '5-star reviews must have a body of at least 50 characters'
      : null;
  },
});

// Remove during promotional event (relax minimum body length)
jt.removeInvariant('https://bookstore.example/Review', 'highRatingRequiresDetailedReview');
```

### Related

- [`addInvariant`](#jsonntology-addinvariant) - register the invariant

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderSchema` and `ReviewSchema` are defined
