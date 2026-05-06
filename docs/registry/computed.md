# `addComputed` and `removeComputed`

Computed fields are properties derived from other fields at instantiate/materialize time - the json-tology equivalent of Pydantic's `@computed_field`. Mark a property with `"jt:computed": true` in the schema and register a compute function. The function runs automatically during `instantiate()` and `materialize()`.

---

## `JsonTology.addComputed` {#jsonntology-addcomputed}

**Declaration.** Registers a compute function for a property marked `"jt:computed": true`. The function receives the fully structural-validated, coerced object and returns the computed value. Can be registered at construction time via `computeds` option or imperatively after construction. The compute function runs after structural validation and before the result is returned from `instantiate()` or `materialize()`.

**Use this when** a property value is mechanically derivable from other fields - `total` from `sum(items[].unitPrice * quantity)`, a `displayTitle` concatenating `title` and `authors[0]`, a `slug` from `title`. Mark the property `jt:computed: true` in the schema to prevent callers from supplying it on input.

**Don't use this when** the rule is a cross-field *validation* constraint (use [`addInvariant`](/registry/invariants) instead). Don't confuse: computed fields *derive* values, invariants *validate* constraints.

### Examples

#### Example 1: Order total derived from line items (construction time)

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';
import { OrderLineSchema } from './bookstore/index.js';

const ComputedOrderSchema = {
  $id: 'https://bookstore.example/ComputedOrder',
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid' },
    placedAt:   { type: 'string', format: 'date-time' },
    items: {
      type: 'array',
      items: { $ref: 'https://bookstore.example/OrderLine' },
      minItems: 1,
    },
    currency: { type: 'string', default: 'USD' },
    total: {
      type: 'number',
      'jt:computed': true,  // ← computed marker
    },
  },
  required: ['id', 'customerId', 'items', 'placedAt'],
  // total NOT in required  - it's always supplied by the compute fn
} as const;

type ComputedOrder = InferType<typeof ComputedOrderSchema>;

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [OrderLineSchema, ComputedOrderSchema] as const,
  computeds: {
    'https://bookstore.example/ComputedOrder': {
      total: (order) => {
        const o = order as ComputedOrder;
        return (o.items as Array<{ unitPrice: number; quantity: number }>)
          .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      },
    },
  },
});
```

#### Example 2: Coerce triggers the compute function

```ts
const order = jt.instantiate(ComputedOrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99 },
    { bookIsbn: '9780062316110', quantity: 1, unitPrice:  9.99 },
  ],
  // total omitted  - computed from items
});

const expectedTotal = 2 * 12.99 + 1 * 9.99;
console.log(Math.abs((order as ComputedOrder).total - expectedTotal) < 0.001); // true
```

#### Example 3: Imperative registration after construction

```ts
jt.addComputed<ComputedOrder>(
  ComputedOrderSchema.$id,
  'total',
  (order) => (order.items as Array<{ unitPrice: number; quantity: number }>)
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0),
);
```

### Behaviour table

| Situation | Result |
|-----------|--------|
| Input omits the computed field | Value is derived and injected |
| Input supplies the computed field | `InstantiationError` with `COMPUTED_INPUT_FORBIDDEN` |
| Compute function throws | `InstantiationError` wrapping the original error |
| Schema registered with `jt:computed` but no function | `SchemaError` with `COMPUTED_FN_MISSING` at registration |

### Bad examples - what NOT to do

#### Anti-pattern 1: Using computed for validation logic

```ts
// ⊥ Don't do this  - computed functions derive values, not validate them
jt.addComputed(OrderSchema.$id, 'total', (order) => {
  if ((order as Order).total < 0) throw new Error('invalid total');
  return (order as Order).total;
});

// ✓ Do this  - use addInvariant for validation
jt.addInvariant(OrderSchema.$id, {
  name: 'totalPositive',
  fn: (order) => (order as Order).total > 0 ? null : 'total must be positive',
});
```

### Comparison

::: code-group

```ts [json-tology]
// Schema authoring:
const schema = {
  properties: {
    total: { type: 'number', 'jt:computed': true },
  },
} as const;

// Function registration:
jt.addComputed(ComputedOrderSchema.$id, 'total',
  (order) => order.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
);
// Or at construction:
JsonTology.create({ computeds: { [schemaId]: { total: fn } } })
```

```ts [Zod]
// Zod uses .transform() to derive values:
const OrderSchema = z.object({ items: z.array(OrderLineSchema) })
  .transform(data => ({
    ...data,
    total: data.items.reduce((s, l) => s + l.unit_price * l.quantity, 0),
  }));
```

```ts [TypeBox + Value]
// Not a first-class concept  - compute manually after validation:
const validated = Value.Check(OrderSchema, data);
const order = { ...data, total: data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0) };
```

```ts [AJV]
// Not built in  - apply after validation:
ajv.validate(orderSchema, data);
data.total = data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
```

```py [Pydantic]
from pydantic import computed_field

class Order(BaseModel):
    items: list[OrderLine]

    @computed_field
    @property
    def total(self) -> float:
        return sum(line.unit_price * line.quantity for line in self.items)
```

:::

### Related

- [`removeComputed`](#jsonntology-removecomputed) - deregister a compute function
- [Invariants](/registry/invariants) - cross-field *validation* rules (complements computed)
- [`JsonTology.instantiate`](/validation/instantiate) - the primary trigger for compute function evaluation

---

## `JsonTology.removeComputed` {#jsonntology-removecomputed}

**Declaration.** Deregisters the compute function for the property `name` on schema `schemaId`. After removal, that property is no longer automatically computed. If the property remains in the schema with `jt:computed: true`, subsequent registrations or instantiate calls may produce a `SchemaError`.

**Use this when** schema configuration changes at runtime - replacing one computation strategy with another (discount tiers, promotional pricing), or toggling computed fields via feature flags.

### Examples

#### Example 1: Replace a compute function

```ts
// Remove the existing totaliser
jt.removeComputed(ComputedOrderSchema.$id, 'total');

// Register a discounted totaliser (10% off for gold-tier customers)
jt.addComputed<ComputedOrder>(ComputedOrderSchema.$id, 'total', (order) => {
  const raw = (order.items as Array<{ unitPrice: number; quantity: number }>)
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return raw * 0.9; // gold tier: 10% discount
});
```

### Related

- [`addComputed`](#jsonntology-addcomputed) - register the compute function

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderLineSchema` is defined
