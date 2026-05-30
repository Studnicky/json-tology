# `addInvariant` and `removeInvariant`

Invariants are cross-field validation rules that run after structural validation succeeds - the json-tology equivalent of Pydantic's `@model_validator(mode='after')`. They integrate with `validate()`, `instantiate()`, and `is()`.

---

## `JsonTology.addInvariant` {#jsonntology-addinvariant}

**Declaration.** Registers an `InvariantInterface<T>` for the schema identified by `schemaId`. The invariant's `fn` function receives a fully structural-validated (clean, defaults-applied) object and returns `null` or `undefined` on success, or an error message string on failure. An optional `pointer` JSON Pointer string pins the error to a specific field path. Invariants run in registration order after structural validation passes.

**Use this when** a business rule involves two or more fields and cannot be expressed as a single-field JSON Schema keyword. Examples: `total` must equal `sum(items[].unitPrice * quantity)`, a date range must have `start <= end`, a 5-star review requires a long body.

**Don't use this when** the constraint can be expressed as a single JSON Schema keyword (`minimum`, `maxLength`, `pattern`, etc.) - structural constraints are faster and run first. Don't confuse with computed fields - invariants *validate*, computed fields *derive*.

### Examples

#### Example 1: Order total must match line items

<RunnableExample src="examples/docs/invariants/01-add-invariant" />

#### Example 2: Invariant failure surfaces in validate(), instantiate(), is()

<RunnableExample src="examples/docs/registry/13-invariant-failure-surfaces" />

#### Example 3: Imperative add after construction

<RunnableExample src="examples/docs/registry/14-invariant-review-body-length" />

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

<RunnableExample src="examples/docs/registry/14-invariant-review-body-length" />

### Comparison

::: code-group

```ts [json-tology]
jt.addInvariant<Order>('https://bookstore.example/Order', {
  name:    'totalMatchesItems',
  pointer: '/orderTotal',
  fn: (order) => {
    const computed = order.orderLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return Math.abs(order.orderTotal - computed) < 0.01 ? null : 'total mismatch';
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

```ts [io-ts]
import * as t from 'io-ts';
// io-ts uses t.refinement to attach a predicate to a codec:
const OrderCodec = t.refinement(
  baseOrderCodec,
  (order) => Math.abs(order.total - order.items.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity, 0,
  )) < 0.01,
  'OrderTotalMatchesItems',
);
// Limitation: io-ts has no registry, so cross-field rules cannot be added
// or removed against a registered schema by name; rebuild the codec.
// Refinement messages are limited to the codec name, not a field-pinned message.
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

<RunnableExample src="examples/docs/registry/15-invariant-remove-promotion" />

### Related

- [`addInvariant`](#jsonntology-addinvariant) - register the invariant

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderSchema` and `ReviewSchema` are defined
