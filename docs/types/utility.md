---
title: Utility Types
description: DeprecatedKeysType, NonDeprecatedSchemaType, LooseInputType, EnumValuesType, ExhaustiveType, and DefaultAlignedType - compile-time schema metadata utilities.
---

# Utility Types <Badge type="info" text="Compile-time" />

> This page covers utility types for working with schema-derived types: deprecated key extraction, loose input boundaries, enum unions, exhaustive checks, and default alignment guards. All examples use the [bookstore domain](/bookstore-domain). See [Schemas](/schemas) for how schemas are registered.

See also [Primary inference](./infer.md), [Range types](./ranges.md).

json-tology exports six utility types for working with schema-derived types. Each has its own section below.

| Type | Purpose |
|------|---------|
| [`DeprecatedKeysType<T>`](#deprecatedkeystype) | Extract keys marked `deprecated: true` |
| [`NonDeprecatedSchemaType<T>`](#nondeprecatedschematype) | Omit deprecated properties from inferred type |
| [`LooseInputType<T>`](#looseinputtype) | Strip constraint brands to base primitive |
| [`EnumValuesType<T>`](#enumvaluestype) | Extract enum values as a TS union |
| [`ExhaustiveType<T>`](#exhaustivetype) | Enforce exhaustive switch/case at compile time |
| [`DefaultAlignedType<T>`](#defaultalignedtype) | `never` when declared defaults mismatch their declared types |

---

## `DeprecatedKeysType<T>`

**Declaration.** Extracts the union of property keys marked `deprecated: true` from an object schema literal. Returns `never` when no properties carry the annotation.

**Use this when** you want compile-time visibility into which properties of a schema are deprecated - for example, to build a lint utility, produce a typed exclusion list, or assert that a particular key is (or is not) deprecated.

**Don't use this when** you only need the filtered object type at a call site; use `NonDeprecatedSchemaType<T>` instead. `DeprecatedKeysType<T>` gives you the _key names_, not the pruned object shape.

### Signature

```ts
export type DeprecatedKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'deprecated': true } ? K : never
      }[keyof P & string]
    : never;
```

### Examples

#### Example 1: Extract deprecated keys from a schema

```ts
import type { DeprecatedKeysType } from 'json-tology/types';
import { CustomerSchema } from '../bookstore/index.js';

// Imagine CustomerSchema had a legacy `phone` field:
const LegacyCustomerSchema = {
  ...CustomerSchema,
  properties: {
    ...CustomerSchema.properties,
    phone: { type: 'string', deprecated: true },
  },
} as const;

type Deprecated = DeprecatedKeysType<typeof LegacyCustomerSchema>;
// 'phone'
```

#### Example 2: Compile-time assertion that a key is deprecated

```ts
import type { DeprecatedKeysType } from 'json-tology/types';

const BookV1Schema = {
  $id: 'https://bookstore.example/BookV1',
  type: 'object',
  properties: {
    isbn:     { type: 'string' },
    title:    { type: 'string' },
    legacySku: { type: 'string', deprecated: true },
  },
  required: ['isbn', 'title'],
} as const;

type DeprecatedBookKeys = DeprecatedKeysType<typeof BookV1Schema>;
// 'legacySku'

// Compile-time guard  - narrows to never if the key is not deprecated:
const _check: DeprecatedBookKeys = 'legacySku'; // OK
// const _bad: DeprecatedBookKeys = 'title';    // compile error
```

### Bad examples

#### Anti-pattern 1: Manual string union

```ts
// ⊥ Don't do this
type DeprecatedBookKeys = 'legacySku';
// drifts from BookV1Schema the moment a second field is deprecated
```

#### Anti-pattern 2: Using it where NonDeprecatedSchemaType is the right tool

```ts
// ⊥ Don't do this  - you want the filtered type, not just the key names
type SafeBook = Omit<InferType<typeof BookV1Schema>, DeprecatedKeysType<typeof BookV1Schema>>;

// Do this instead:
type SafeBook = NonDeprecatedSchemaType<typeof BookV1Schema>;
```

### Comparison

::: code-group

```ts [json-tology]
type Deprecated = DeprecatedKeysType<typeof BookV1Schema>;
// 'legacySku'  - compile-time union of deprecated key names
```

```ts [Zod]
// Zod v3.24+ supports .deprecated() on individual fields.
// There is no built-in type-level utility to extract deprecated key names.
// Introspection is runtime-only via schema._def.
import { z } from 'zod';
const BookV1 = z.object({
  isbn:      z.string(),
  legacySku: z.string().deprecated(),
});
// No equivalent of DeprecatedKeysType  - cannot extract 'legacySku' at type level.
```

```ts [TypeBox]
// TypeBox supports { deprecated: true } as a JSON Schema annotation.
// No built-in utility type extracts deprecated key names  - annotation is metadata only.
import { Type, Static } from '@sinclair/typebox';
const BookV1 = Type.Object({
  isbn:      Type.String(),
  legacySku: Type.String({ deprecated: true }),
});
// Static<typeof BookV1> includes legacySku  - no compile-time filtering.
```

```ts [AJV]
// AJV is a runtime validator  - no TypeScript type-level extraction of deprecated keys.
// Maintain the list manually.
```

```py [Pydantic]
# Pydantic v2 supports Field(deprecated=True) for runtime introspection.
# Returns a deprecation warning at access time, not a type-level key union.
from pydantic import BaseModel, Field

class BookV1(BaseModel):
    isbn: str
    legacy_sku: str = Field(default=None, deprecated=True)

# model_fields['legacy_sku'].metadata contains the deprecation annotation.
# No equivalent of DeprecatedKeysType  - introspection is runtime only.
```

:::

### Related

- `NonDeprecatedSchemaType` - obtain the pruned object type rather than the key union
- [`InferType`](./infer.md#infertype) - full object type including deprecated properties

### See also

- [Schemas](/schemas) - declaring `deprecated: true` on a property
- [Constraint Brands](/constraint-brands) - other compile-time schema metadata utilities

---

## `NonDeprecatedSchemaType<T>`

**Declaration.** Derives the TypeScript object type for a schema literal with all properties marked `deprecated: true` omitted. Delegates to `InferType<T>` and applies `Omit<…, DeprecatedKeysType<T>>`.

**Use this when** you want a type that represents the "current" shape of an object after stripping legacy fields - for example, for API response types or view models that should never surface deprecated properties.

**Don't use this when** you need to read or write deprecated properties (e.g. migration code that must still handle them). Use `InferType<T>` directly when you need access to all properties.

### Signature

```ts
export type NonDeprecatedSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = T extends { readonly 'properties': unknown; readonly 'type': 'object' }
    ? SimplifyType<Omit<InferType<T, TRoot, TReferences>, DeprecatedKeysType<T>>>
    : InferType<T, TRoot, TReferences>;
```

### Examples

#### Example 1: Schema with a deprecated field

```ts
import type { InferType, NonDeprecatedSchemaType } from 'json-tology/types';

const BookV1Schema = {
  $id: 'https://bookstore.example/BookV1',
  type: 'object',
  properties: {
    isbn:      { type: 'string' },
    title:     { type: 'string' },
    legacySku: { type: 'string', deprecated: true },
  },
  required: ['isbn', 'title'],
} as const;

type BookV1Full    = InferType<typeof BookV1Schema>;
// { readonly isbn: string; readonly title: string; readonly legacySku?: string }

type BookV1Current = NonDeprecatedSchemaType<typeof BookV1Schema>;
// { readonly isbn: string; readonly title: string }
//  - legacySku is gone
```

#### Example 2: Using as a return type for a view layer function

```ts
import type { NonDeprecatedSchemaType } from 'json-tology/types';
import { BookV1Schema } from '../bookstore/index.js';

function toBookView(raw: unknown): NonDeprecatedSchemaType<typeof BookV1Schema> {
  // instantiate validates and returns the full type; the return type annotation
  // signals that callers should not depend on deprecated fields.
  const book = jt.instantiate(BookV1Schema.$id, raw);
  const { legacySku: _dropped, ...rest } = book;
  return rest;
}
```

### Bad examples

#### Anti-pattern 1: Manual Omit with a string literal

```ts
// ⊥ Don't do this
type BookV1Current = Omit<InferType<typeof BookV1Schema>, 'legacySku'>;
// drifts when more fields are marked deprecated  - the Omit list becomes stale
```

### Comparison

::: code-group

```ts [json-tology]
type BookV1Current = NonDeprecatedSchemaType<typeof BookV1Schema>;
// Automatically omits all properties where deprecated: true
```

```ts [Zod]
// Zod v3 has no built-in type-level filter for deprecated fields.
// Runtime workaround: parse then strip manually.
// No compile-time equivalent.
```

```ts [TypeBox]
// TypeBox has no built-in type-level filter for deprecated annotations.
// Static<T> always includes all declared properties regardless of deprecated metadata.
```

```ts [AJV]
// Not applicable  - AJV is a runtime validator with no type inference.
// There is no TypeScript-level equivalent.
```

```py [Pydantic]
# Pydantic v2 supports model_dump(exclude_deprecated=True) for runtime serialization.
# There is no compile-time type that omits deprecated fields.
from pydantic import BaseModel, Field

class BookV1(BaseModel):
    isbn: str
    legacy_sku: str | None = Field(default=None, deprecated=True)

data = BookV1(isbn='9780000000001', legacy_sku='OLD-1')
data.model_dump(exclude_deprecated=True)
# {'isbn': '9780000000001'}  - but the static type still includes legacy_sku
```

:::

### Related

- `DeprecatedKeysType` - extract just the deprecated key names
- [`InferType`](./infer.md#infertype) - full type including deprecated properties

### See also

- [Schemas](/schemas) - declaring `deprecated: true` on a property
- [Constraint Brands](/constraint-brands) - other compile-time schema metadata utilities

---

## `LooseInputType<T>`

**Declaration.** Strips constraint brands from a schema-inferred type, returning the underlying TypeScript primitive. `string & FormatBrand<'email'>` becomes `string`; `number & MinimumBrand<0>` becomes `number`; object and array types fall back to `Record<string, unknown>` and `readonly unknown[]` respectively.

**Use this when** you are writing a function that accepts user input _before_ validation - for example, a form handler, a CLI parser, or a test helper - where you want to accept plain primitives without requiring callers to produce pre-validated branded values.

**Don't use this when** the value has already been validated; keep the branded type to preserve the constraint guarantee. `LooseInputType<T>` is an input-boundary utility, not a way to discard safety after validation.

### Signature

```ts
export type LooseInputType<T>
  = [T] extends [string] ? string
    : [T] extends [number] ? number
      : [T] extends [boolean] ? boolean
        : [T] extends [readonly unknown[]] ? readonly unknown[]
          : [T] extends [Record<string, unknown>] ? Record<string, unknown>
            : unknown;
```

### Examples

#### Example 1: Accepting unvalidated customer input

```ts
import type { InferType, LooseInputType } from 'json-tology/types';
import { CustomerSchema } from '../bookstore/index.js';

type Customer      = InferType<typeof CustomerSchema>;
// { readonly id: string & FormatBrand<'uuid'>; readonly email: string & FormatBrand<'email'>; ... }

type CustomerInput = LooseInputType<Customer>;
// Record<string, unknown>  - strips all brands for raw-input boundaries

function createCustomerFromForm(raw: CustomerInput): Customer {
  return jt.instantiate(CustomerSchema.$id, raw); // validates and re-brands
}
```

#### Example 2: Stripping brands from a single field type

```ts
import type { InferType, LooseInputType } from 'json-tology/types';
import { ReviewSchema } from '../bookstore/index.js';

type Review       = InferType<typeof ReviewSchema>;
type ReviewBody   = Review['body'];
// string & MinLengthBrand<10>

type LooseBody = LooseInputType<ReviewBody>;
// string  - plain string, no brand
```

#### Example 3: Test helpers that produce fixture data

```ts
import type { InferType, LooseInputType } from 'json-tology/types';
import { OrderSchema } from '../bookstore/index.js';

type Order = InferType<typeof OrderSchema>;

// Test factory accepts plain primitives  - no need to produce branded values
function orderFixture(overrides: Partial<LooseInputType<Order>> = {}): unknown {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    customerId: '00000000-0000-0000-0000-000000000002',
    items: [],
    total: 9.99,
    placedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}
```

### Bad examples

#### Anti-pattern 1: Stripping brands after validation

```ts
// ⊥ Don't do this
const customer = jt.instantiate(CustomerSchema.$id, raw);
const loose: LooseInputType<typeof customer> = customer;
// You just discarded the validation guarantee  - keep the branded type
```

#### Anti-pattern 2: Using it as a permanent storage type

```ts
// ⊥ Don't do this
type StoredCustomer = LooseInputType<InferType<typeof CustomerSchema>>;
// Storage types should carry brands so downstream code stays safe
```

### Comparison

::: code-group

```ts [json-tology]
type CustomerInput = LooseInputType<InferType<typeof CustomerSchema>>;
// Record<string, unknown>  - brands stripped, safe for raw-input boundaries
```

```ts [Zod]
// Concept not directly applicable  - Zod types are structural (no phantom brands).
// Zod's z.infer<T> already returns plain primitives with no brand intersections.
// For input boundaries, Zod uses z.input<T> vs z.output<T> for transform coercion.
import { z } from 'zod';
type CustomerInput = z.input<typeof CustomerSchema>; // pre-transform type
```

```ts [TypeBox]
// TypeBox types are plain structural TypeScript  - no constraint brands exist.
// Static<T> already gives the plain type; LooseInputType has no equivalent need.
import type { Static } from '@sinclair/typebox';
type CustomerInput = Static<typeof CustomerSchema>; // already brand-free
```

```ts [AJV]
// Not applicable  - AJV provides no type inference.
// Types are always declared manually as plain interfaces.
```

```py [Pydantic]
# Concept specific to json-tology's constraint brand system.
# Pydantic uses the same class for both input (pre-validation) and output (post-validation).
# For loose input, use a TypedDict or dict[str, Any] at the boundary layer.
from typing import Any
CustomerInput = dict[str, Any]
```

:::

### Related

- `EnumValuesType` - when you need the enum union, not the stripped primitive
- [Constraint Brands](/constraint-brands) - the brand system that `LooseInputType` strips

### See also

- [Schemas](/schemas) - how constraint keywords produce brands
- [`InferType`](./infer.md#infertype) - the fully branded output type

---

## `EnumValuesType<T>`

**Declaration.** Extracts the union of `enum` values from a schema literal. Works on any schema shape that carries an `enum` array; returns `never` when no `enum` is declared.

**Use this when** you have a registered or imported schema with an `enum` constraint and need the corresponding TypeScript union for switch statements, function parameters, or component props. Prefer this over hand-typing `'USD' | 'EUR' | ...` because the union stays in sync with the schema literal.

**Don't use this when** the schema is dynamic at runtime (loaded from a file or remote URL) - type-level extraction requires the schema as a `const` literal at compile time. For runtime-only enum lists, use `schema.enum` (the array value) directly.

### Signature

```ts
export type EnumValuesType<T>
  = T extends { readonly 'enum': ReadonlyArray<infer V> } ? V : never;
```

### Examples

#### Example 1: Currency enum from an inline schema

```ts
import type { EnumValuesType } from 'json-tology/types';

const CurrencySchema = {
  $id: 'https://bookstore.example/Currency',
  type: 'string',
  enum: ['USD', 'EUR', 'GBP', 'JPY'],
} as const;

type Currency = EnumValuesType<typeof CurrencySchema>;
// 'USD' | 'EUR' | 'GBP' | 'JPY'
```

#### Example 2: With `ExhaustiveType` for an exhaustive switch

```ts
import type { EnumValuesType, ExhaustiveType } from 'json-tology/types';

const CurrencySchema = {
  type: 'string',
  enum: ['USD', 'EUR', 'GBP'],
} as const;

type Currency = EnumValuesType<typeof CurrencySchema>;

function currencySymbol(c: Currency): string {
  switch (c) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: {
      const _: ExhaustiveType<typeof c> = c;
      return _;
      // Adding 'JPY' to the enum without adding a case here becomes a compile error
    }
  }
}
```

#### Example 3: As a function parameter type

```ts
import type { EnumValuesType } from 'json-tology/types';
import { BookSchema } from '../bookstore/index.js';

// BookSchema.properties.currency is { type: 'string', default: 'USD' }
//  - no enum here, so this illustrates a standalone currency schema:
const CurrencySchema = { type: 'string', enum: ['USD', 'EUR', 'GBP'] } as const;

type Currency = EnumValuesType<typeof CurrencySchema>;

function formatPrice(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' };
  return `${symbols[currency]}${amount.toFixed(2)}`;
}
```

### Bad examples

#### Anti-pattern 1: Hand-rolled duplicate union

```ts
// ⊥ Don't do this
type Currency = 'USD' | 'EUR' | 'GBP';
// drifts from CurrencySchema.enum the moment someone adds 'JPY'
```

#### Anti-pattern 2: Unsafe index access

```ts
// ⊥ Don't do this
type Currency = (typeof CurrencySchema)['enum'][number];
// Breaks when enum is not a const array; EnumValuesType handles edge cases (single-element enums, mixed types)
```

### Comparison

::: code-group

```ts [json-tology]
type Currency = EnumValuesType<typeof CurrencySchema>;
// 'USD' | 'EUR' | 'GBP'  - derived from schema.enum at compile time
```

```ts [Zod]
import { z } from 'zod';
const Currency = z.enum(['USD', 'EUR', 'GBP']);
type Currency = z.infer<typeof Currency>;
// 'USD' | 'EUR' | 'GBP'  - Zod owns both schema and type
```

```ts [TypeBox]
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

const Currency = Type.Union([
  Type.Literal('USD'),
  Type.Literal('EUR'),
  Type.Literal('GBP'),
]);
type Currency = Static<typeof Currency>;
// 'USD' | 'EUR' | 'GBP'
```

```ts [AJV]
// AJV is a runtime validator  - no type-level extraction.
// Maintain the union manually:
type Currency = 'USD' | 'EUR' | 'GBP';
```

```py [Pydantic]
# Python uses Literal for enum-style unions:
from typing import Literal
Currency = Literal['USD', 'EUR', 'GBP']

# Or extract from a model field annotation at runtime:
# typing.get_args(model.model_fields['currency'].annotation)
```

:::

### Related

- `ExhaustiveType` - pair with `EnumValuesType` for exhaustive switch checks
- `LooseInputType` - when you want to accept the base primitive at function boundaries

### See also

- [Schemas](/schemas) - declaring `enum` on a property
- [Constraint Brands](/constraint-brands) - when the union is also branded

---

## `ExhaustiveType<T>`

**Declaration.** A compile-time marker type that accepts only `never`. Use it in the `default` branch of a switch statement to enforce that all union members are handled. If a new case is added to the union without a corresponding `case` clause, the type check fails.

**Use this when** you are switching over an `EnumValuesType<T>` union (or any discriminated union) and want the TypeScript compiler to flag missing cases. The pattern is identical to the standard "exhaustive check" idiom used across the TypeScript ecosystem - `ExhaustiveType<T>` is a named alias that makes the intent explicit.

**Don't use this when** the union is intentionally open (you want a fallthrough default). The utility is for closed, fully-enumerated unions only.

### Signature

```ts
export type ExhaustiveType<T extends never> = T;
```

### Examples

#### Example 1: Exhaustive switch over a Review rating

```ts
import type { ExhaustiveType, IntegerRangeType } from 'json-tology/types';

type Rating = IntegerRangeType<1, 5>; // 1 | 2 | 3 | 4 | 5

function ratingLabel(r: Rating): string {
  switch (r) {
    case 1: return 'Poor';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Very Good';
    case 5: return 'Excellent';
    default: {
      const _: ExhaustiveType<typeof r> = r;
      return _;
    }
  }
}
```

#### Example 2: Pairing with `EnumValuesType` for a string enum

```ts
import type { EnumValuesType, ExhaustiveType } from 'json-tology/types';

const OrderStatusSchema = {
  type: 'string',
  enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
} as const;

type OrderStatus = EnumValuesType<typeof OrderStatusSchema>;

function describeStatus(s: OrderStatus): string {
  switch (s) {
    case 'pending':   return 'Awaiting confirmation';
    case 'confirmed': return 'Confirmed, preparing shipment';
    case 'shipped':   return 'In transit';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Order cancelled';
    default: {
      const _: ExhaustiveType<typeof s> = s;
      return _;
      // Adding 'refunded' to the schema.enum without a case here → compile error
    }
  }
}
```

### Bad examples

#### Anti-pattern 1: Using `never` directly instead of the named alias

```ts
// Works, but intent is less clear
default: {
  const _: never = s;
  return _;
}

// Prefer the named form  - communicates exhaustiveness intent explicitly:
default: {
  const _: ExhaustiveType<typeof s> = s;
  return _;
}
```

#### Anti-pattern 2: Omitting the default branch entirely

```ts
// ⊥ Don't do this  - TypeScript may not error on missing cases without the check
function describeStatus(s: OrderStatus): string {
  switch (s) {
    case 'pending': return 'Awaiting confirmation';
    // ... other cases, but no default exhaustiveness check
    // Adding a new status value silently falls through
  }
}
```

### Comparison

::: code-group

```ts [json-tology]
default: {
  const _: ExhaustiveType<typeof s> = s;
  return _;
}
// ExhaustiveType<T> is an alias for `T extends never`  - a named version of the
// standard TypeScript exhaustiveness idiom.
```

```ts [Zod]
// Pure TypeScript pattern  - not Zod-specific.
// Every TS codebase reimplements it; the standard form is:
default: {
  const _: never = s;
  return _;
}
```

```ts [TypeBox]
// Same pure TypeScript pattern  - not TypeBox-specific.
default: {
  const _exhaustiveCheck: never = s;
  return _exhaustiveCheck;
}
```

```ts [AJV]
// Same pure TypeScript pattern  - AJV does not affect type narrowing.
default: {
  const _: never = s;
  return _;
}
```

```py [Pydantic]
# Python's match/case with a wildcard arm and assert_never from typing:
from typing import assert_never

match status:
    case 'pending':   ...
    case 'confirmed': ...
    case _:
        assert_never(status)  # type error if the match is not exhaustive
```

:::

### Related

- `EnumValuesType` - the closed union to switch over
- [`IntegerRangeType`](./ranges.md#integerrangetype) - integer literal unions that pair naturally with exhaustive checks

### See also

- [Schemas](/schemas) - declaring `enum` constraints
- [Constraint Brands](/constraint-brands) - integer range literals

---

## `DefaultAlignedType<T>`

**Declaration.** Compile-time guard that resolves to the schema type `T` when all properties with `default` values have defaults that match their declared `type`, and resolves to `never` otherwise. Checks `string`, `boolean`, `integer`, and `number` fields; unrecognised property shapes pass through.

**Use this when** you want a compile-time assertion that schema defaults are type-correct - for example, as a generic constraint on a function that registers schemas, ensuring a misconfigured schema is caught before it reaches runtime.

**Don't use this when** you only want runtime validation of defaults; the schema compiler already validates defaults at registration time. `DefaultAlignedType<T>` is a static analysis utility, not a replacement for runtime checks.

### Signature

```ts
export type DefaultAlignedType<T>
  = T extends { readonly 'properties': infer TP }
    ? CheckPropertyDefaultsType<TP> extends true ? T : never
    : T;
```

### Examples

#### Example 1: A well-aligned schema passes through

```ts
import type { DefaultAlignedType } from 'json-tology/types';

const BookSchema = {
  $id: 'https://bookstore.example/Book',
  type: 'object',
  properties: {
    currency: { type: 'string',  default: 'USD'  },
    inStock:  { type: 'boolean', default: true   },
    price:    { type: 'number',  exclusiveMinimum: 0 }, // no default  - passes through
  },
  required: ['price'],
} as const;

type AlignedBook = DefaultAlignedType<typeof BookSchema>;
// typeof BookSchema  - same type, defaults are aligned
```

#### Example 2: A misaligned default resolves to `never`

```ts
import type { DefaultAlignedType } from 'json-tology/types';

const BadSchema = {
  type: 'object',
  properties: {
    currency: { type: 'string', default: 42 }, // ⊥ number default for string field
  },
} as const;

type MisalignedBook = DefaultAlignedType<typeof BadSchema>;
// never  - default 42 is not assignable to 'string'
```

#### Example 3: Using as a generic constraint on a registration helper

```ts
import type { DefaultAlignedType } from 'json-tology/types';

function registerChecked<T>(schema: DefaultAlignedType<T>): void {
  // DefaultAlignedType<T> ensures the schema never reaches this function
  // when its defaults are misaligned  - the call site becomes a compile error.
  jt.register(schema as T);
}

registerChecked(BookSchema);  // OK  - defaults are aligned
// registerChecked(BadSchema); // compile error  - resolves to never
```

### Bad examples

#### Anti-pattern 1: Runtime-only default validation

```ts
// ⊥ Relying on runtime to catch misaligned defaults:
const BadSchema = {
  type: 'object',
  properties: { currency: { type: 'string', default: 42 } },
} as const;

jt.register(BadSchema); // runtime error  - but could have been caught at compile time
```

### Comparison

::: code-group

```ts [json-tology]
type AlignedBook = DefaultAlignedType<typeof BookSchema>;
// typeof BookSchema  - passes through when all defaults match declared types
// never  - when any default is misaligned
// Concept specific to json-tology's compile-time validation of `default` values.
```

```ts [Zod]
// Zod .default() takes a value and infers its type from the schema.
// Type mismatches are caught at the z.default() call site, not via a utility type.
import { z } from 'zod';
const BookSchema = z.object({
  currency: z.string().default('USD'),  // type-safe: default must be string
  // z.string().default(42) → TypeScript error at definition
});
// No equivalent of DefaultAlignedType  - Zod's API enforces it structurally.
```

```ts [TypeBox]
// TypeBox accepts { default: value } as metadata but does not validate
// that the value matches the declared type at compile time.
// No equivalent of DefaultAlignedType.
```

```ts [AJV]
// AJV validates defaults at runtime (via ajv-defaults plugin).
// No compile-time equivalent.
```

```py [Pydantic]
# Pydantic v2 validates default values against field types at class definition time.
# A type-mismatched default raises a ValidationError at import time  - no separate utility needed.
from pydantic import BaseModel

class Book(BaseModel):
    currency: str = 'USD'  # OK
    # price: int = 'free'  # ValidationError at class definition  - caught early
```

:::

### Related

- [`InferType`](./infer.md#infertype) - infer the full object type once defaults are known to be aligned
- [Schemas](/schemas) - declaring `default` values on properties

### See also

- [Constraint Brands](/constraint-brands) - other compile-time schema validation utilities
