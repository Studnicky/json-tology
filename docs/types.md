# Type Inference

> This guide covers `InferType`, `InferSchemaType`, `Transform.brand`, constraint brands, and utility types. All examples use the [bookstore domain](/bookstore-domain). See [Schemas](/schemas) for how schemas are registered.

json-tology derives TypeScript types from `as const` JSON Schema literals at compile time. No code generation. No separate type declarations. The types flow through `coerce()`, `is()`, and the registry type map automatically.

---

## InferType

Derives a TypeScript type from an `as const` JSON Schema literal.

### Signature

```ts
type MyType = InferType<typeof MySchema>
// Equivalent to: InferSchemaType<typeof MySchema, typeof MySchema, {}>
```

### When to use

Use `InferType<T>` everywhere you need the TypeScript type corresponding to a schema. It handles objects, arrays, enums, `const`, `$ref`, `oneOf`, `allOf`, `if/then/else`, and composition. Use `InferSchemaType<T, Root, Refs>` directly only when you need to specify a different root schema for `$ref` resolution within a sub-schema.

### Examples

#### Example 1: Object schema with required and optional fields

```ts
import type { InferType } from 'json-tology';

// From the bookstore domain (see /bookstore-domain)
type Customer = InferType<typeof CustomerSchema>;
// {
//   readonly id: string & FormatBrand<'uuid'>;
//   readonly email: string & FormatBrand<'email'>;
//   readonly name: string;
//   readonly addresses?: readonly (Address)[];
// }

type Address = InferType<typeof AddressSchema>;
// {
//   readonly street: string;
//   readonly city: string;
//   readonly postalCode: string;
//   readonly country?: string;
// }
```

The `addresses` array has `default: []` in the schema — at the type level it remains optional because `default` is a runtime concept; at runtime `coerce()` always fills it in.

#### Example 2: Integer range, enum, and const

```ts
import type { InferType } from 'json-tology';

// rating: minimum 1, maximum 5 — auto-generates literal union
type Rating = InferType<typeof ReviewSchema>['rating'];
// 1 | 2 | 3 | 4 | 5

const CurrencySchema = {
  $id: 'https://bookstore.example/Currency',
  type: 'string',
  enum: ['USD', 'EUR', 'GBP', 'JPY'],
} as const;

type Currency = InferType<typeof CurrencySchema>;
// 'USD' | 'EUR' | 'GBP' | 'JPY'
```

Bounded `integer` schemas with both bounds in the 0–50 range automatically produce literal unions. See [Constraint Brands](/constraint-brands#structural-narrowing) for details on integer ranges and multipleOf ranges.

#### Example 3: Cross-schema `$ref` resolution

When a schema references another by absolute IRI, pass a reference map as the second type argument.

```ts
import type { InferType } from 'json-tology';

type Order = InferType<typeof OrderSchema, {
  'https://bookstore.example/OrderLine': typeof OrderLineSchema;
}>;
// {
//   readonly id: string & FormatBrand<'uuid'>;
//   readonly customerId: string & FormatBrand<'uuid'>;
//   readonly items: readonly OrderLine[];   ← resolved from the ref map
//   readonly total: number;
//   readonly currency?: string;
//   readonly placedAt: string & FormatBrand<'date-time'>;
// }
```

Without the reference map, `items` would resolve to `unknown` at the element level.

### Comparison

::: code-group

```ts [json-tology]
import type { InferType } from 'json-tology';

const CustomerSchema = { ... } as const;
type Customer = InferType<typeof CustomerSchema>;
```

```ts [Zod]
import { z } from 'zod';

const CustomerSchema = z.object({
  id:    z.string().uuid(),
  email: z.string().email(),
  name:  z.string(),
});
type Customer = z.infer<typeof CustomerSchema>;
```

```ts [TypeBox]
import { Type } from '@sinclair/typebox';

const CustomerSchema = Type.Object({
  id:    Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  name:  Type.String(),
});
// TypeBox exposes Static<T> for type inference:
import type { Static } from '@sinclair/typebox';
type Customer = Static<typeof CustomerSchema>;
```

```ts [AJV]
// AJV validates at runtime but provides no compile-time type inference.
// Types must be declared separately and kept in sync manually.
interface Customer {
  id: string;
  email: string;
  name: string;
}
```

```py [Pydantic]
from pydantic import BaseModel, Field

class Customer(BaseModel):
    id: str
    email: str
    name: str

# Python type annotations ARE the schema — no separate inference step.
```

:::

### Related

- [Constraint Brands](/constraint-brands) — format, string, numeric, array brands
- `InferSchemaType` — explicit root control for sub-schema inference
- [Schemas](/schemas) — how schemas are registered

---

## InferSchemaType

Lower-level inference with explicit `Root` and `Refs` parameters. Resolves `$ref` against the specified root schema.

### Signature

```ts
type MySubType = InferSchemaType<
  typeof SubSchema,    // The sub-schema to infer
  typeof RootSchema,   // Root schema providing $defs for $ref resolution
  RefMap               // Optional cross-schema reference map
>
```

### When to use

Use when you need to infer the type of a sub-schema that uses `$ref: '#/$defs/...'` pointing into a larger parent schema. `InferType<T>` calls `InferSchemaType<T, T>` automatically — explicit use is only needed when the sub-schema and the root are different objects.

### Examples

#### Example 1: Infer a sub-schema type from $defs

```ts
import type { InferSchemaType } from 'json-tology';

const CatalogSchema = {
  $id: 'https://bookstore.example/Catalog',
  type: 'object',
  properties: {
    featured: { $ref: '#/$defs/FeaturedBook' },
  },
  $defs: {
    FeaturedBook: {
      type: 'object',
      properties: {
        isbn:  { type: 'string' },
        badge: { type: 'string', enum: ['bestseller', 'new', 'staff-pick'] },
      },
      required: ['isbn', 'badge'],
    },
  },
} as const;

type FeaturedBook = InferSchemaType<
  typeof CatalogSchema['$defs']['FeaturedBook'],
  typeof CatalogSchema
>;
// { readonly isbn: string; readonly badge: 'bestseller' | 'new' | 'staff-pick' }
```

### Comparison

::: code-group

```ts [json-tology]
type Sub = InferSchemaType<typeof SubSchema, typeof RootSchema>;
```

```ts [Zod]
// Not applicable — Zod types are derived per-schema, not from a root.
// Nested types are inferred via z.infer<typeof SubSchema>.
```

```ts [TypeBox]
// TypeBox infers from the sub-object directly using Static<T>.
// No explicit root concept.
```

```ts [AJV]
// Not applicable — AJV provides no TypeScript inference.
```

```py [Pydantic]
# Not applicable — Python uses class-based types, not JSON Pointer sub-schemas.
```

:::

---

## Constraint brands

json-tology surfaces JSON Schema constraint keywords as compile-time phantom brands. Two values with different constraints produce structurally incompatible TypeScript types.

The only way to obtain a branded value is through the validation API (`coerce`, `is`, `materialize`, etc.), which enforces that data has passed runtime checks before being treated as a constrained type.

See [Constraint Brands](/constraint-brands) for the full reference, configuration flags, and structural narrowing features.

### Examples

#### Example 1: Format brands prevent mixing email and UUID strings

```ts
import type { InferType } from 'json-tology';

type Customer = InferType<typeof CustomerSchema>;

// customer.id has type: string & FormatBrand<'uuid'>
// customer.email has type: string & FormatBrand<'email'>

// TypeScript rejects this at compile time:
// const id: typeof customer.id = customer.email; // error — incompatible brands

// The only way to produce a branded value:
const customer = jt.coerce(CustomerSchema.$id, rawData); // typed + validated
```

#### Example 2: Integer range as literal union

```ts
// ReviewSchema has: rating: { type: 'integer', minimum: 1, maximum: 5 }
type Review = InferType<typeof ReviewSchema>;
type Rating = Review['rating']; // 1 | 2 | 3 | 4 | 5

const r: Rating = 3;   // OK
// const bad: Rating = 0;  // compile error — 0 is not in 1..5
```

#### Example 3: Disable brands for a project

Create a `.d.ts` anywhere in your `tsconfig include` path:

```ts
// json-tology.d.ts
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface {
    brands: false; // disables all phantom brands
  }
}
```

All `InferType` results revert to plain TypeScript primitives. Runtime validation is unaffected.

### Comparison

::: code-group

```ts [json-tology]
// Brands are on by default.
// string & FormatBrand<'email'> is incompatible with string & FormatBrand<'uuid'>.
type Email = InferType<typeof EmailSchema>; // string & FormatBrand<'email'>
```

```ts [Zod]
// Zod supports .brand<'Email'>() for nominal typing.
const EmailSchema = z.string().email().brand<'Email'>();
type Email = z.infer<typeof EmailSchema>; // string & z.BRAND<'Email'>
// Must be applied manually per schema — not automatic from JSON Schema keywords.
```

```ts [TypeBox]
// TypeBox does not generate phantom brands from JSON Schema constraints.
// All string schemas infer as string.
type Email = Static<typeof EmailSchema>; // string
```

```ts [AJV]
// AJV provides no type inference — no brands possible.
```

```py [Pydantic]
# Pydantic v2 supports Annotated types for similar constraint propagation:
from pydantic import EmailStr
from typing import Annotated

class Customer(BaseModel):
    email: EmailStr  # validated as email at runtime, typed as str
```

:::

### Related

- [Constraint Brands](/constraint-brands) — full brand reference and configuration
- `Transform.brand` — explicit nominal brands on schema `$id`

---

## Utility types

json-tology exports utility types for working with schema-derived types.

| Type | Purpose |
|------|---------|
| `DeprecatedKeysType<T>` | Extract keys marked `deprecated: true` |
| `NonDeprecatedSchemaType<T>` | Omit deprecated properties from inferred type |
| `LooseInputType<T>` | Strip brands to base primitive |
| `EnumValuesType<T>` | Extract enum values as a union |
| `ExhaustiveType<T>` | Enforce exhaustive switch/case |
| `DefaultAlignedType<T>` | `never` when defaults mismatch declared types |
| `IntegerRangeType<Min, Max>` | Manual literal union for integer ranges |
| `MultipleOfRangeType<Min, Max, Step>` | Stepped literal union for multiples |

```ts
import type {
  EnumValuesType,
  ExhaustiveType,
  LooseInputType,
  InferType,
} from 'json-tology';

const CurrencySchema = {
  $id: 'https://bookstore.example/Currency',
  type: 'string',
  enum: ['USD', 'EUR', 'GBP'],
} as const;

type Currency = EnumValuesType<typeof CurrencySchema>; // 'USD' | 'EUR' | 'GBP'

function formatPrice(amount: number, currency: Currency): string {
  switch (currency) {
    case 'USD': return `$${amount}`;
    case 'EUR': return `€${amount}`;
    case 'GBP': return `£${amount}`;
    default:    return currency satisfies ExhaustiveType<typeof currency>;
  }
}

// LooseInputType strips brands for function parameters
type BookInput = LooseInputType<InferType<typeof BookSchema>>;
// All branded string/number fields revert to plain string/number
```

See [Constraint Brands](/constraint-brands) for complete documentation on each utility type.
