# Computed Fields

> This guide covers `addComputed`, `removeComputed`, and the `jt:computed` schema keyword. All examples use the [bookstore domain](/bookstore-domain). See [Validation](/validation#coerce) for how `coerce` runs compute functions, and [Invariants](/invariants) for post-validation cross-field rules.

Computed fields are properties derived from other fields at coerce/materialize time — the json-tology equivalent of Pydantic's `@computed_field`. Mark a property with `"jt:computed": true` in the schema and register a function that computes its value. The function runs automatically during `coerce()` and `materialize()`.

---

## addComputed

Registers a compute function for a property marked `jt:computed: true`.

### Signature

```ts
public addComputed<T = Record<string, unknown>>(
  schemaId: string,
  name: keyof T & string,
  fn: (data: T) => unknown
): void
```

### When to use

Use computed fields when a property's value is mechanically derivable from other fields — for example, an order's `total` is `sum(items[].unitPrice * quantity)`, or a book's `displayTitle` concatenates `title` and the first author. Computed fields are validated after structural validation, so they receive a clean, coerced object.

Use `removeComputed` when schema configuration changes at runtime — for example, replacing a simple totaliser with one that applies a customer-specific discount rate.

### Examples

#### Example 1: Order total computed from line items

Mark `total` as computed in the schema, then register the function. Building on `OrderSchema` and `OrderLineSchema` from the [bookstore domain](/bookstore-domain).

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology';

// Schema declares total as computed — omit from required
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
      'jt:computed': true,   // ← computed marker
    },
  },
  required: ['id', 'customerId', 'items', 'placedAt'],
  // total is NOT in required — its value is always supplied by the compute function
} as const;

type ComputedOrder = InferType<typeof ComputedOrderSchema>;

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [OrderLineSchema, ComputedOrderSchema] as const,
  computeds: {
    'https://bookstore.example/ComputedOrder': {
      total: (order) => {
        const typed = order as ComputedOrder;
        return (typed.items as Array<{ unitPrice: number; quantity: number }>)
          .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      },
    },
  },
});
```

#### Example 2: Coerce triggers compute function

The compute function runs automatically. Supplying `total` in the input triggers `CoercionError`.

```ts
const order = jt.coerce(ComputedOrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99 },
    { bookIsbn: '9780062316110', quantity: 1, unitPrice:  9.99 },
  ],
  // total is omitted — computed from items
});

console.log(order.total); // 35.97 (2 * 12.99 + 1 * 9.99)
```

#### Example 3: Imperative registration — add after construction

```ts
jt.addComputed<ComputedOrder>(
  ComputedOrderSchema.$id,
  'total',
  (order) => order.items.reduce(
    (sum, line) => sum + (line as { unitPrice: number; quantity: number }).unitPrice
      * (line as { unitPrice: number; quantity: number }).quantity,
    0
  ),
);

// Remove when no longer needed:
jt.removeComputed(ComputedOrderSchema.$id, 'total');
```

### Comparison

::: code-group

```ts [json-tology]
// Schema authoring:
const ComputedOrderSchema = {
  $id: '...',
  properties: {
    total: { type: 'number', 'jt:computed': true },
  },
} as const;

// Function registration:
const jt = JsonTology.create({
  computeds: {
    'https://bookstore.example/ComputedOrder': {
      total: (order) => order.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    },
  },
});
// Or imperatively:
jt.addComputed(schemaId, 'total', fn);
```

```ts [Zod]
// Zod uses .transform() to derive values after parsing:
const OrderSchema = z.object({
  items: z.array(z.object({ unitPrice: z.number(), quantity: z.number() })),
}).transform(data => ({
  ...data,
  total: data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
}));
// type is inferred as the transformed shape
```

```ts [TypeBox]
// Not directly supported — TypeBox validates structure only.
// Compute total manually after validation:
const valid = Value.Check(OrderSchema, data);
const order = { ...data, total: data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0) };
```

```ts [AJV]
// Not directly supported — apply after validation:
ajv.validate(orderSchema, data);
data.total = data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
```

```py [Pydantic]
from pydantic import BaseModel, computed_field

class Order(BaseModel):
    items: list[OrderLine]

    @computed_field
    @property
    def total(self) -> float:
        return sum(line.unit_price * line.quantity for line in self.items)
```

:::

### Behaviour table

| Situation | Result |
|-----------|--------|
| Input omits the computed field | Value is derived and injected |
| Input supplies the computed field | `CoercionError` with `COMPUTED_INPUT_FORBIDDEN` |
| Compute function throws | `CoercionError` wrapping the original error |
| Schema registered with `jt:computed` but no function | `SchemaError` with `COMPUTED_FN_MISSING` at registration |

Computed fields run after structural validation in both `coerce()` and `materialize()`. They re-run on every call — no caching.

### Related

- `removeComputed` — deregister a compute function
- [Invariants](/invariants) — cross-field validation rules that run after structural validation (complements computed fields)
- [Validation](/validation#coerce) — `coerce` is the primary trigger for computed field evaluation

---

## removeComputed

Removes a previously registered compute function.

### Signature

```ts
public removeComputed(schemaId: string, name: string): void
```

### When to use

Use when schema configuration changes at runtime — for example, when a discount tier changes the `total` computation rule, or when rolling back a dynamic feature flag. After removal, the property is no longer computed; supplying it in the input is required if it's in the `required` array.

### Examples

#### Example 1: Swap a compute function

```ts
// Original simple totaliser
jt.addComputed(ComputedOrderSchema.$id, 'total',
  (order) => (order as ComputedOrder).items.reduce(
    (s, l) => s + (l as { unitPrice: number; quantity: number }).unitPrice * (l as { unitPrice: number; quantity: number }).quantity,
    0
  )
);

// Replace with a discounted totaliser (e.g. after customer tier update)
jt.removeComputed(ComputedOrderSchema.$id, 'total');
jt.addComputed(ComputedOrderSchema.$id, 'total',
  (order) => {
    const raw = (order as ComputedOrder).items.reduce(
      (s, l) => s + (l as { unitPrice: number; quantity: number }).unitPrice * (l as { unitPrice: number; quantity: number }).quantity,
      0
    );
    return raw * 0.9; // 10% discount
  }
);
```

### Related

- `addComputed` — register the compute function
