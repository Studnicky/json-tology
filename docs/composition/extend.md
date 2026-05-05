# `Compose.extend`

**Declaration.** Creates a new schema by emitting `{ $id: newId, allOf: [{ $ref: parent.$id }, additionsSchema] }`. The base schema is referenced by its `$id` (not flattened or copied), and the additions become a sibling object schema in the `allOf` array. The base schema's `required` constraints flow through unchanged via the `$ref`. The `$id` is replaced with the new `newId` argument. Input schemas are never mutated. Per-key merge happens for `jt:config` (child wins). TypeScript infers the merged type automatically.

**Use this when** you need to add fields to an existing schema while inheriting its existing properties and required constraints. Classic use: adding tier-specific fields to `Customer`, adding audit fields to `Order`, adding a display badge to `Book`.

**Don't use this when** you need all constituent schemas' required constraints to apply simultaneously and the base must also be inlined rather than referenced (use [`intersection`](/composition/intersection) directly with `allOf` instead). Don't use it when you want to narrow properties (use [`pick`](/composition/pick-omit)). Don't use it if the added fields should all be optional with default-only filling (use [`materialize`](/registry/materialize) instead).

## Examples

### Example 1: Add discount tier to Customer

Building on `CustomerSchema` from the [bookstore domain](/bookstore-domain):

```ts
import { Compose } from 'json-tology';
import type { InferType } from 'json-tology';
import { CustomerSchema } from './bookstore/index.js';

const CustomerWithDiscountSchema = Compose.extend(
  CustomerSchema,
  {
    discountRate: { type: 'number', minimum: 0, maximum: 1, default: 0 },
    tier:         { type: 'string', enum: ['bronze', 'silver', 'gold'] },
  } as const,
  'https://bookstore.example/CustomerWithDiscount',
);

type CustomerWithDiscount = InferType<typeof CustomerWithDiscountSchema>;
// Customer & { discountRate?: number; tier?: 'bronze' | 'silver' | 'gold' }
```

### Example 2: Extend Book with featured display info

```ts
import { Compose, JsonTology } from 'json-tology';
import { BookSchema } from './bookstore/index.js';

const FeaturedBookSchema = Compose.extend(
  BookSchema,
  {
    badge:    { type: 'string', enum: ['bestseller', 'new', 'staff-pick'] },
    position: { type: 'integer', minimum: 1 },
  } as const,
  'https://bookstore.example/FeaturedBook',
);

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [FeaturedBookSchema] as const,
});

const featured = jt.instantiate(FeaturedBookSchema.$id, {
  isbn:     '9780140449136',
  title:    'Crime and Punishment',
  authors:  ['Fyodor Dostoevsky'],
  price:    14.99,
  badge:    'bestseller',
  position: 1,
});
// featured.badge === 'bestseller'
// featured.isbn === '9780140449136' (inherited)
```

### Example 3: Tighten a property in the additions side of the allOf

`Compose.extend` does not flatten `properties` over the base. The additions appear as a second `allOf` entry, so a property declared in the additions becomes an *additional* constraint that must hold alongside the base's constraint. Both must be satisfied, which is how `allOf` works in JSON Schema. Use this when you want to add a stricter constraint on top of the base.

```ts
const PremiumBookSchema = Compose.extend(
  BookSchema,
  { price: { type: 'number', minimum: 25 } } as const,  // minimum raised from 0+
  'https://bookstore.example/PremiumBook',
);
```

## Bad examples - what NOT to do

### Anti-pattern 1: Using extend when you need required on the new fields

```ts
import { Compose } from 'json-tology';

// ⊥ Don't do this  - extend inherits required from base; new fields are NOT required
const Extended = Compose.extend(CustomerSchema, { tier: { type: 'string' } } as const, '...');
// tier is optional  - extend only merges properties, required comes from base

// ✓ Do this  - use intersection if the added schema needs its own required array
const WithRequiredTier = {
  $id: 'https://bookstore.example/TierSchema',
  type: 'object',
  properties: { tier: { type: 'string' } },
  required: ['tier'],
} as const;
const Extended2 = Compose.intersection([CustomerSchema, WithRequiredTier] as const, '...');
```

### Anti-pattern 2: Chaining extend to build a history of derivations without registering intermediates

```ts
// ⊥ Don't do this  - extends don't need to be registered to be extended further,
// but intermediates used in coerce/validate must be registered
const A = Compose.extend(CustomerSchema, { x: { type: 'string' } } as const, '...a');
const B = Compose.extend(A, { y: { type: 'number' } } as const, '...b');
jt.instantiate(B.$id, data); // fails  - B is not registered

// ✓ Register before use
jt.register(B);
jt.instantiate(B.$id, data); // works
```

## Comparison

::: code-group

```ts [json-tology]
const CustomerWithDiscount = Compose.extend(
  CustomerSchema,
  { discountRate: { type: 'number', default: 0 } } as const,
  'https://bookstore.example/CustomerWithDiscount',
);
```

```ts [Zod]
const CustomerWithDiscount = CustomerSchema.extend({
  discountRate: z.number().default(0),
});
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
const CustomerWithDiscount = Type.Composite([
  CustomerSchema,
  Type.Object({ discountRate: Type.Number({ default: 0 }) }),
]);
// Type.Composite merges properties from multiple schemas
```

```ts [AJV]
const CustomerWithDiscount = {
  ...CustomerSchema,
  $id: 'https://bookstore.example/CustomerWithDiscount',
  properties: {
    ...CustomerSchema.properties,
    discountRate: { type: 'number', default: 0 },
  },
};
```

```py [Pydantic]
class CustomerWithDiscount(Customer):
    discount_rate: float = 0.0
    tier: str | None = None
```

:::

## Related

- [`intersection`](/composition/intersection) - when all schemas' `required` constraints must apply
- [`partial`](/composition/partial-required) - make all fields optional after extension
- [`pick`](/composition/pick-omit) - keep only a subset of properties
- [`Schemas`](/schemas#register) - registering extended schemas before use

## See also

- [Bookstore domain](/bookstore-domain) - where `CustomerSchema` and `BookSchema` are defined
- [Composition index](/composition/) - overview of all composition operations
