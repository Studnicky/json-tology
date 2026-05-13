# Constraint Brands — Structural Narrowing

> Siblings: [Branded Keywords](./keywords) &nbsp;|&nbsp; [Validation modes reference](/validation-modes)

Beyond phantom brands on individual keywords, the type system narrows structural TypeScript types from JSON Schema constraints. These narrowings produce literal union types, template literal key types, and conditional discriminated unions — all at compile time.

## Structural narrowing <Badge type="info" text="Compile-time" />

### Auto integer ranges <Badge type="info" text="Compile-time" />

Bounded `integer` schemas with both bounds in the 0-50 range automatically produce literal union types:

```ts
const RatingSchema = {
  type: 'integer',
  minimum: 1,
  maximum: 5,
} as const;

type Rating = InferType<typeof RatingSchema>;
// 1 | 2 | 3 | 4 | 5

const r: Rating = 3;   // compiles
const bad: Rating = 0;  // compile error  - 0 is not in 1..5
```

Exclusive bounds are normalized automatically: `exclusiveMinimum: 0` becomes inclusive minimum `1`, `exclusiveMaximum: 6` becomes inclusive maximum `5`.

### multipleOf stepped ranges <Badge type="info" text="Compile-time" />

When `multipleOf` is present alongside bounds, only multiples within the range are included:

```ts
const EvenDiceSchema = {
  type: 'integer',
  minimum: 1,
  maximum: 6,
  multipleOf: 2,
} as const;

type EvenDice = InferType<typeof EvenDiceSchema>;
// 2 | 4 | 6
```

Use `MultipleOfRangeType<Min, Max, Step>` as a standalone utility for arbitrary stepped ranges.

### `not` exclusion <Badge type="warning" text="Compile-time + Runtime" />

Simple `not` clauses narrow the inferred type:

```ts
// not: { type }  - removes primitives from unions
const NonStringSchema = {
  type: ['string', 'number', 'boolean'],
  not: { type: 'string' },
} as const;

type NonString = InferType<typeof NonStringSchema>;
// boolean | number

// not: { const }  - removes specific values
const NonNullStatusSchema = {
  enum: ['active', 'inactive', null],
  not: { const: null },
} as const;

type NonNullStatus = InferType<typeof NonNullStatusSchema>;
// 'active' | 'inactive'

// not: { enum }  - removes a set of values
const RestrictedSchema = {
  enum: ['a', 'b', 'c', 'd'],
  not: { enum: ['b', 'c'] },
} as const;

type Restricted = InferType<typeof RestrictedSchema>;
// 'a' | 'd'
```

### `propertyNames: { enum }` strict keys <Badge type="info" text="Compile-time" />

When `propertyNames` specifies an enum, the object keys are narrowed to that union:

```ts
const ConfigSchema = {
  type: 'object',
  propertyNames: { enum: ['host', 'port', 'debug'] },
  additionalProperties: { type: 'string' },
} as const;

type Config = InferType<typeof ConfigSchema>;
// { readonly host?: string; readonly port?: string; readonly debug?: string }
```

### `patternProperties` template literal keys <Badge type="info" text="Compile-time" />

Anchored regex patterns are converted to TypeScript template literal types. Four pattern shapes are recognised:

| Pattern | Inferred key type |
|---|---|
| `^data_` | `` `data_${string}` `` |
| `_id$` | `` `${string}_id` `` |
| `^exact$` | `'exact'` (literal) |
| `^(a\|b\|c)$` | `'a' \| 'b' \| 'c'` (literal union) |
| `` ^[class]+suffix$ `` | `` `${string}suffix` `` |
| `^.{N}$` (N ≤ 8) | length-N template literal |
| Other patterns | `string` (fallback) |

```ts
const MetadataSchema = {
  type: 'object',
  patternProperties: {
    '^data_': { type: 'string' },
    '^meta_': { type: 'number' },
  },
} as const;

type Metadata = InferType<typeof MetadataSchema>;

const ok: Metadata = { data_name: 'Alice', meta_version: 1 };     // compiles
const bad: Metadata = { data_age: 99 };                            // compile error  - must be string
```

Multiple `patternProperties` entries are intersected so each pattern enforces its own value type.

### `if/then/else` generalised narrowing <Badge type="warning" text="Compile-time + Runtime" />

`if/then/else` narrowing recognises three property forms in `if.properties`: `{ const: V }`, `{ enum: [...] }`, and `{ type: 'string' | 'number' | ... }`. Multi-property discriminators intersect all literals at once. Every property in `if.properties` must appear in `required` for narrowing to apply; otherwise the inferred type is the union of both branches.

For a single const discriminator:

```ts
const ShapeSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string' },
  },
  required: ['kind'],
  if: { properties: { kind: { const: 'circle' } }, required: ['kind'] },
  then: { properties: { radius: { type: 'number' } }, required: ['radius'] },
  else: { properties: { width: { type: 'number' } }, required: ['width'] },
} as const;

type Shape = InferType<typeof ShapeSchema>;
// Union of:
//   { kind: 'circle'; radius: number; ... }     - then branch, kind narrowed to 'circle'
// | { kind: string; width: number; ... }         - else branch
```

Multi-property discriminator example:

```ts
const MultiDiscriminatorSchema = {
  type: 'object',
  properties: {
    kind:  { type: 'string' },
    color: { type: 'string' },
  },
  required: ['kind', 'color'],
  if: {
    properties: { kind: { const: 'circle' }, color: { const: 'red' } },
    required:   ['kind', 'color'],
  },
  then: { properties: { radius: { type: 'number' } }, required: ['radius'] },
  else: { properties: { width:  { type: 'number' } }, required: ['width'] },
} as const;

type MultiShape = InferType<typeof MultiDiscriminatorSchema>;
// { kind: 'circle'; color: 'red'; radius: number; ... }  - then branch
// | { kind: string; color: string; width: number; ... }  - else branch
```

### `dependentRequired` conditional typing <Badge type="warning" text="Compile-time + Runtime" />

Modeled as a per-trigger union. When the trigger key is present, all its dependents become required:

```ts
const PaymentSchema = {
  type: 'object',
  properties: {
    credit_card: { type: 'string' },
    billing_address: { type: 'string' },
  },
  dependentRequired: {
    credit_card: ['billing_address'],
  },
} as const;

type Payment = InferType<typeof PaymentSchema>;
// Either:
//   { credit_card?: never; billing_address?: string }    - no credit card, address optional
// | { billing_address: unknown; ... }                     - credit card present → address required
```

## `uniqueItems` tuple distinctness <Badge type="warning" text="Compile-time + Runtime" />

`uniqueItems: true` is enforced at two compile-time levels depending on the array shape:

1. **Homogeneous arrays** — the inferred type carries `UniqueArrayBrandInterface<T>` (a generic uniqueness brand parameterised by element type). A plain `T[]` cannot satisfy it; values must come through `JsonTology.instantiate` / coerce / `materialize`.

2. **Literal-typed tuples** (≤ 8 elements via `prefixItems`) — `UniqueTuplePairwiseType` runs a pairwise overlap check at the type level and collapses the tuple to `never` when any pair of element types overlaps. This means `{ prefixItems: [{ const: 'red' }, { const: 'red' }], uniqueItems: true }` is a compile-time error.

Above 8 elements the pairwise check is skipped and runtime validation still enforces `uniqueItems`.

> **Note:** Compile-time tuple pairwise checking applies only to literal-typed tuples declared via `prefixItems` with ≤ 8 elements. Homogeneous arrays (e.g. `string[]`) receive only the `UniqueArrayBrandInterface<T>` brand and rely on runtime enforcement for actual uniqueness — there is no compile-time element-by-element comparison for homogeneous arrays.

```ts
const DuplicateConstTuple = {
  type: 'array',
  prefixItems: [
    { const: 'red' },
    { const: 'red' },   // duplicate — same literal type
  ],
  uniqueItems: true,
} as const;

type DuplicateTuple = InferType<typeof DuplicateConstTuple>;
// never — the pairwise check detected the overlap at compile time
```

## `tightStringLengths` opt-in narrowing <Badge type="info" text="Compile-time" />

When a project augments `JsonTologyTypeConfigInterface` with `'tightStringLengths': true`, `InferType` narrows strings whose `minLength`/`maxLength` bounds are within `StringLengthCap = 8` to a union of fixed-length character template literals.

```ts
// json-tology.d.ts — opt in
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface { 'tightStringLengths': true }
}
```

```ts
const ThreeCharSchema = {
  type: 'string',
  minLength: 3,
  maxLength: 3,
} as const;

type ThreeChar = InferType<typeof ThreeCharSchema>;
// `${string}${string}${string}` — exactly 3 characters

const OneToThreeSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 3,
} as const;

type OneToThree = InferType<typeof OneToThreeSchema>;
// `${string}` | `${string}${string}` | `${string}${string}${string}`
```

Bounds above the cap (or with the flag disabled) fall back to plain `string`. The flag is default-off so existing schemas pay no compile cost.

## See also

- [Branded Keywords](./keywords) - string, number, array, object, and nominal brands
- [Type Inference](/types/infer) - how `InferType` resolves narrowings and brand intersections
- [Composition — discriminated union](/composition/discriminated-union) - `if/then/else` in schema composition
- [Bookstore domain](/bookstore-domain) - real-world narrowing examples
