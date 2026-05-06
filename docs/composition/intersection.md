# `Compose.intersection`

**Declaration.** Creates a new `allOf` schema that combines multiple schemas. Data must satisfy every constituent schema simultaneously. TypeScript infers the intersection of all constituent types. The `$id` is set to `newId`.

**Use this when** data must satisfy multiple independent schemas - for example, an `AuditedOrder` must satisfy both `Order` constraints and `Audit` constraints including their respective `required` arrays. This is stronger than [`extend`](/composition/extend), which only merges properties into one flat object.

**Don't use this when** you only need to merge property definitions without additional required constraints (use [`extend`](/composition/extend) - simpler, more predictable). Don't use it for union types (use [`discriminatedUnion`](/composition/discriminated-union)).

## Examples

### Example 1: Add audit fields to Order

Both `Order` and `Audit` required arrays must be satisfied.

```ts
import { Compose, JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';
import { OrderLineSchema, OrderSchema } from './bookstore/index.js';

const AuditSchema = {
  $id: 'https://bookstore.example/Audit',
  type: 'object',
  properties: {
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    createdBy: { type: 'string' },
  },
  required: ['createdAt', 'updatedAt'],
} as const;

const AuditedOrderSchema = Compose.intersection(
  [OrderSchema, AuditSchema] as const,
  'https://bookstore.example/AuditedOrder',
);

type AuditedOrder = InferType<typeof AuditedOrderSchema>;
// Order & { createdAt: string; updatedAt: string; createdBy?: string }

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [OrderLineSchema, OrderSchema, AuditSchema, AuditedOrderSchema] as const,
});
```

### Example 2: Validation fails if any constituent schema fails

```ts
// Missing createdAt and updatedAt from AuditSchema required:
const errors = jt.validate(AuditedOrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      14.99,
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 14.99 }],
  // createdAt and updatedAt missing
});
console.log(errors.length > 0); // true
```

### Example 3: getDefaults on an intersection schema

Build on [`Compose.getDefaults`](/composition/get-defaults) - extracting defaults from an intersection walks each constituent.

```ts
import { Compose } from 'json-tology';

const defaults = Compose.getDefaults(OrderSchema);
// { currency: 'USD' }
// Combined schemas' defaults are merged at validation time
```

## Bad examples - what NOT to do

### Anti-pattern 1: Using intersection when extend is simpler

```ts
import { Compose } from 'json-tology';

// ⊥ Don't do this for simple property merging  - allOf is heavier than needed
const ExtendedSchema = Compose.intersection(
  [BookSchema, { type: 'object', properties: { badge: { type: 'string' } } }] as const,
  'https://bookstore.example/ExtendedBook',
);

// ✓ Do this  - extend is designed for this
const ExtendedSchema2 = Compose.extend(
  BookSchema,
  { badge: { type: 'string' } } as const,
  'https://bookstore.example/ExtendedBook',
);
```

## Comparison

::: code-group

```ts [json-tology]
Compose.intersection([OrderSchema, AuditSchema] as const, 'https://bookstore.example/AuditedOrder')
// Produces allOf: [OrderSchema, AuditSchema]
// Both required arrays must be satisfied
```

```ts [Zod]
OrderSchema.and(AuditSchema)
// Or: z.intersection(OrderSchema, AuditSchema)
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
Type.Intersect([OrderSchema, AuditSchema])
```

```ts [AJV]
const AuditedOrderSchema = {
  $id: 'https://bookstore.example/AuditedOrder',
  allOf: [OrderSchema, AuditSchema],
};
```

```py [Pydantic]
class AuditedOrder(Order, Audit):
    # Multiple inheritance achieves allOf semantics
    pass
```

:::

## Related

- [`extend`](/composition/extend) - simpler for just adding properties without separate required constraints
- [`discriminatedUnion`](/composition/discriminated-union) - for oneOf with type discriminator
- [`partial`](/composition/partial-required) - make the intersected result partially optional

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderSchema` is defined
- [Composition index](/composition/) - overview of all composition operations
