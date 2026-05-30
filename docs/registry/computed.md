# `addComputed` and `removeComputed`

Computed fields are properties derived from other fields at instantiate/materialize time - the json-tology equivalent of Pydantic's `@computed_field`. Mark a property with `"jt:computed": true` in the schema and register a compute function. The function runs automatically during `instantiate()` and `materialize()`.

---

## `JsonTology.addComputed` {#jsonntology-addcomputed}

**Declaration.** Registers a compute function for a property marked `"jt:computed": true`. The function receives the fully structural-validated, coerced object and returns the computed value. Can be registered at construction time via `computeds` option or imperatively after construction. The compute function runs after structural validation and before the result is returned from `instantiate()` or `materialize()`.

**Use this when** a property value is mechanically derivable from other fields - `total` from `sum(items[].unitPrice * quantity)`, a `displayTitle` concatenating `title` and `authors[0]`, a `slug` from `title`. Mark the property `jt:computed: true` in the schema to prevent callers from supplying it on input.

**Don't use this when** the rule is a cross-field *validation* constraint (use [`addInvariant`](/registry/invariants) instead). Don't confuse: computed fields *derive* values, invariants *validate* constraints.

### Examples

#### Example 1: Order total derived from line items (construction time)

<<< ../../examples/docs/computed/01-add-computed.ts

#### Example 2: Coerce triggers the compute function

<<< ../../examples/docs/registry/08-computed-coerce-triggers.ts

#### Example 3: Imperative registration after construction

<<< ../../examples/docs/registry/09-computed-imperative-add.ts

### Behaviour table

| Situation | Result |
|-----------|--------|
| Input omits the computed field | Value is derived and injected |
| Input supplies the computed field | `InstantiationError` with `COMPUTED_INPUT_FORBIDDEN` |
| Compute function throws | `InstantiationError` wrapping the original error |
| Schema registered with `jt:computed` but no function | `SchemaError` with `COMPUTED_FN_MISSING` at registration |

### Bad examples - what NOT to do

#### Anti-pattern 1: Using computed for validation logic

<<< ../../examples/docs/registry/09-computed-imperative-add.ts

### Comparison

::: code-group

```ts [json-tology]
// Schema authoring:
const schema = {
  properties: {
    orderTotal: { type: 'number', 'jt:computed': true },
  },
} as const;

// Function registration:
jt.addComputed(ComputedOrderSchema.$id, 'orderTotal',
  (order) => order.orderLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
);
// Or at construction:
JsonTology.create({ computeds: { [schemaId]: { orderTotal: fn } } })
```

```ts [Zod]
// Zod uses .transform() to derive values:
const OrderSchema = z.object({ items: z.array(OrderLineSchema) })
  .transform(data => ({
    ...data,
    total: data.items.reduce((s, l) => s + l.unit_price * l.quantity, 0),
  }));
```

```ts [Valibot]
import * as v from 'valibot';
const OrderSchema = v.pipe(
  v.object({ items: v.array(OrderLineSchema) }),
  v.transform((data) => ({
    ...data,
    total: data.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
  })),
);
// Limitation: Valibot has no registry of computed properties addressable
// by name; the derivation is baked into the pipe and cannot be added
// or removed against a registered schema after construction.
```

```ts [io-ts]
import * as t from 'io-ts';
import type { Either } from 'fp-ts/Either';
// io-ts has no computed-field concept. Build a custom codec whose decode
// derives the field after the structural codec validates:
const ComputedOrderCodec = new t.Type<Order, OrderInput, unknown>(
  'ComputedOrder',
  (input): input is Order => true,
  (input, ctx): Either<t.Errors, Order> => {
    const decoded = baseOrderCodec.decode(input);
    if (decoded._tag === 'Left') return decoded;
    const order = decoded.right;
    return t.success({
      ...order,
      total: order.items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    });
  },
  (output) => output as OrderInput,
);
// Limitation: no registry of named computeds; derivation is baked into the
// codec and cannot be added or removed by name after construction.
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

- [`removeComputed`](#jsonntology-removecomputed) - deregister a compute function
- [Invariants](/registry/invariants) - cross-field *validation* rules (complements computed)
- [`JsonTology.instantiate`](/validation/instantiate) - the primary trigger for compute function evaluation

---

## `JsonTology.removeComputed` {#jsonntology-removecomputed}

**Declaration.** Deregisters the compute function for the property `name` on schema `schemaId`. After removal, that property is no longer automatically computed. If the property remains in the schema with `jt:computed: true`, subsequent registrations or instantiate calls may produce a `SchemaError`.

**Use this when** schema configuration changes at runtime - replacing one computation strategy with another (discount tiers, promotional pricing), or toggling computed fields via feature flags.

### Examples

#### Example 1: Replace a compute function

<<< ../../examples/docs/registry/10-computed-replace-fn.ts

### Related

- [`addComputed`](#jsonntology-addcomputed) - register the compute function

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderLineSchema` is defined
