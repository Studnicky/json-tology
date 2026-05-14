---
title: Range Types
description: IntegerRangeType and MultipleOfRangeType - compile-time literal unions for bounded numeric ranges.
---

# Range Types <Badge type="info" text="Compile-time" />

> This page covers `IntegerRangeType` and `MultipleOfRangeType`: compile-time utilities that produce literal unions for bounded integer ranges. All examples use the [bookstore domain](/bookstore-domain). See [Schemas](/schemas) for how schemas are registered.

See also [Primary inference](./infer.md), [Utility types](./utility.md).

---

## `IntegerRangeType<Min, Max>`

**Declaration.** Produces a union of integer literals from `Min` to `Max` (inclusive). Both bounds must be non-negative integer literals within the cap of 50 (the internal `IntegerRangeCap`). When either bound is the general `number` type, or when the range exceeds the cap, the utility falls back to `number`.

**Use this when** you want a literal union for a bounded integer range - for example, `1 | 2 | 3 | 4 | 5` for a star-rating field - and you are authoring the bounds directly rather than deriving them from a schema. When bounds come from a schema, `InferType<T>` produces the range automatically; `IntegerRangeType<Min, Max>` is for explicit manual usage.

**Don't use this when** the range is large (over ~50 entries). Type-level integer ranges are a TypeScript-specific challenge: literal union types blow up past roughly 1 000 members, causing slow type checking and IDE lag. For large ranges, use `number` with a runtime validator instead. The 50-entry cap is enforced to keep compilation fast.

### Signature

```ts
export type IntegerRangeType<TMin extends number, TMax extends number>
  = number extends TMin ? number
    : number extends TMax ? number
      : RangeWithinCapType<TMax> extends true
        ? BuildIntegerRangeType<TMin, TMax>
        : number;
```

### Examples

#### Example 1: Star rating range

```ts
import type { IntegerRangeType } from 'json-tology/types';

type StarRating = IntegerRangeType<1, 5>;
// 1 | 2 | 3 | 4 | 5

const r: StarRating = 3;   // OK
// const bad: StarRating = 0;  // compile error
// const bad: StarRating = 6;  // compile error
```

#### Example 2: Deriving automatically via `InferType`

```ts
import type { InferType } from 'json-tology/types';
import { ReviewSchema } from '../bookstore/index.js';

// ReviewSchema.properties.rating: { type: 'integer', minimum: 1, maximum: 5 }
type Rating = InferType<typeof ReviewSchema>['rating'];
// 1 | 2 | 3 | 4 | 5  - same result, derived from schema automatically

// Use IntegerRangeType<1,5> only when you need the range without a schema:
import type { IntegerRangeType } from 'json-tology/types';
type RatingManual = IntegerRangeType<1, 5>; // explicit form
```

#### Example 3: Small page-size range for a paginated query

```ts
import type { IntegerRangeType } from 'json-tology/types';

type PageSize = IntegerRangeType<1, 50>;
// 1 | 2 | 3 | ... | 50

function fetchBooks(page: number, pageSize: PageSize): Promise<unknown[]> {
  // pageSize is compile-time bounded  - no need for a runtime min/max guard
  return Promise.resolve([]);
}
```

### Bad examples

#### Anti-pattern 1: Large ranges

```ts
// ⊥ Don't do this  - IntegerRangeType<1, 1000> falls back to number (cap is 50)
type ArticleId = IntegerRangeType<1, 1000>;
// Falls back to number  - use a branded number type or runtime validation instead
```

#### Anti-pattern 2: Floating-point bounds

```ts
// ⊥ Don't do this  - bounds must be non-negative integer literals
type Price = IntegerRangeType<0.5, 9.99>;
// Produces unexpected results  - IntegerRangeType is for integers only
```

### Comparison

::: code-group

```ts [json-tology]
type StarRating = IntegerRangeType<1, 5>;
// 1 | 2 | 3 | 4 | 5  - compile-time literal union, capped at 50
```

```ts [Zod]
// Zod runtime-only  - no equivalent type-level literal union.
import { z } from 'zod';
const starRating = z.number().int().min(1).max(5);
type StarRating = z.infer<typeof starRating>; // number  - not a literal union
```

```ts [TypeBox]
// TypeBox has no built-in type-level integer range utility.
// Type.Integer({ minimum: 1, maximum: 5 }) infers as number via Static<T>.
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
const StarRating = Type.Integer({ minimum: 1, maximum: 5 });
type StarRating = Static<typeof StarRating>; // number  - not a literal union
```

```ts [AJV]
// AJV is runtime-only  - no type-level integer range.
// Declare the type manually or use a branded number.
type StarRating = 1 | 2 | 3 | 4 | 5;
```

```py [Pydantic]
# Python uses Annotated with Ge/Le constraints, not literal unions:
from typing import Annotated
from pydantic import Field

StarRating = Annotated[int, Field(ge=1, le=5)]
# Validated at runtime; no equivalent type-level literal union.
```


```ts [Valibot]
// Limitation: feature not directly supported in Valibot. See /comparisons for the matrix.
```

```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [io-ts]
// Limitation: feature not directly supported in io-ts. See /comparisons for the matrix.
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

- `MultipleOfRangeType` - stepped variant (every N-th integer in a range)
- [`ExhaustiveType`](./utility.md#exhaustivetype) - pair with integer ranges for exhaustive switch checks

### See also

- [Constraint Brands](/constraint-brands) - `MinimumBrand` / `MaximumBrand` numeric brands
- [Schemas](/schemas) - `minimum` / `maximum` on integer schemas (auto-derives the range)

---

## `MultipleOfRangeType<Min, Max, Step>`

**Declaration.** Produces a union of integer literals within `[Min, Max]` (inclusive) that are divisible by `Step`. Starts at `0`, increments by `Step`, and includes values that fall within the range. Caps at 50 iterations; returns `number` when any parameter is the general `number` type or the cap is exceeded.

**Use this when** you have a `multipleOf` constraint on a bounded integer schema and want the resulting TypeScript type to be a precise literal union rather than `number`. `InferType<T>` produces this automatically when the schema carries both `minimum`/`maximum` and `multipleOf`; `MultipleOfRangeType<Min, Max, Step>` lets you express the same constraint explicitly without a schema.

**Don't use this when** the range or step combination would produce more than ~50 values - the cap kicks in and the type falls back to `number`. For large stepped ranges, use a branded `number` type with runtime validation.

### Signature

```ts
export type MultipleOfRangeType<
  TMin extends number, TMax extends number, TStep extends number
>
  = number extends TMin ? number
    : number extends TMax ? number
      : number extends TStep ? number
        : BuildMultipleOfRangeType<TMin, TMax, TStep>;
```

### Examples

#### Example 1: Even numbers in a range

```ts
import type { MultipleOfRangeType } from 'json-tology/types';

type EvenQuantity = MultipleOfRangeType<0, 10, 2>;
// 0 | 2 | 4 | 6 | 8 | 10

const q: EvenQuantity = 6;   // OK
// const bad: EvenQuantity = 3; // compile error  - 3 is not a multiple of 2
```

#### Example 2: Deriving automatically via `InferType`

```ts
import type { InferType } from 'json-tology/types';

const EvenQuantitySchema = {
  type: 'integer',
  minimum: 0,
  maximum: 10,
  multipleOf: 2,
} as const;

type EvenQuantity = InferType<typeof EvenQuantitySchema>;
// 0 | 2 | 4 | 6 | 8 | 10  - same result, derived from schema automatically

// Use MultipleOfRangeType explicitly only when you need it without a schema:
import type { MultipleOfRangeType } from 'json-tology/types';
type EvenQuantityManual = MultipleOfRangeType<0, 10, 2>;
```

#### Example 3: Discount tiers in 5% increments

```ts
import type { MultipleOfRangeType } from 'json-tology/types';

// Discounts from 0% to 50% in 5% steps
type DiscountPercent = MultipleOfRangeType<0, 50, 5>;
// 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50

function applyDiscount(price: number, discount: DiscountPercent): number {
  return price * (1 - discount / 100);
}
```

### Bad examples

#### Anti-pattern 1: Stepped range that exceeds the cap

```ts
// ⊥ Don't do this  - MultipleOfRangeType<0, 100, 1> produces 101 values, exceeds cap
type AllPercentages = MultipleOfRangeType<0, 100, 1>;
// Falls back to number  - use a runtime validator or branded number instead
```

#### Anti-pattern 2: Step of zero

```ts
// ⊥ Don't do this  - step of 0 produces an infinite loop in the type recursion
type BadRange = MultipleOfRangeType<0, 10, 0>;
// Undefined behaviour  - always use a positive non-zero step
```

### Comparison

::: code-group

```ts [json-tology]
type EvenQuantity = MultipleOfRangeType<0, 10, 2>;
// 0 | 2 | 4 | 6 | 8 | 10  - compile-time literal union, capped at 50 iterations
```

```ts [Zod]
// Zod runtime-only  - no type-level stepped range.
import { z } from 'zod';
const evenQuantity = z.number().int().min(0).max(10).multipleOf(2);
type EvenQuantity = z.infer<typeof evenQuantity>; // number  - not a literal union
```

```ts [TypeBox]
// TypeBox has no built-in type-level multipleOf range utility.
// Type.Integer({ minimum: 0, maximum: 10, multipleOf: 2 }) infers as number.
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
const EvenQty = Type.Integer({ minimum: 0, maximum: 10, multipleOf: 2 });
type EvenQuantity = Static<typeof EvenQty>; // number  - not a literal union
```

```ts [AJV]
// AJV is runtime-only  - no type-level stepped range.
type EvenQuantity = number; // declare manually; validate with multipleOf at runtime
```

```py [Pydantic]
# Python uses Annotated with MultipleOf constraint  - validated at runtime:
from typing import Annotated
from pydantic import Field

EvenQuantity = Annotated[int, Field(ge=0, le=10, multiple_of=2)]
# No equivalent type-level literal union.
```


```ts [Valibot]
// Limitation: feature not directly supported in Valibot. See /comparisons for the matrix.
```

```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [io-ts]
// Limitation: feature not directly supported in io-ts. See /comparisons for the matrix.
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

- `IntegerRangeType` - unstepped variant (every integer in a range)
- [`ExhaustiveType`](./utility.md#exhaustivetype) - pair with stepped ranges for exhaustive switch checks

### See also

- [Constraint Brands](/constraint-brands) - `MultipleOfBrand` numeric brand
- [Schemas](/schemas) - `multipleOf` combined with `minimum`/`maximum` (auto-derives the stepped range)
