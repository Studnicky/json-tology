# Constraint Brands: Structural Narrowing

> Siblings: [Branded Keywords](./keywords) &nbsp;|&nbsp; [Validation modes reference](/validation-modes)

Beyond phantom brands on individual keywords, the type system narrows structural TypeScript types from JSON Schema constraints. These narrowings produce literal union types, template literal key types, and conditional discriminated unions - all at compile time.

## Structural narrowing <Badge type="info" text="Compile-time" />

### Auto integer ranges <Badge type="info" text="Compile-time" />

Bounded `integer` schemas with both bounds in the 0-50 range automatically produce literal union types:

<<< ../../examples/docs/constraint-brands/01-narrowing.ts

Exclusive bounds are normalized automatically: `exclusiveMinimum: 0` becomes inclusive minimum `1`, `exclusiveMaximum: 6` becomes inclusive maximum `5`.

### multipleOf stepped ranges <Badge type="info" text="Compile-time" />

When `multipleOf` is present alongside bounds, only multiples within the range are included:

<<< ../../examples/docs/constraint-brands/14-multipleof-range.ts

Use `MultipleOfRangeType<Min, Max, Step>` as a standalone utility for arbitrary stepped ranges.

### `not` exclusion <Badge type="warning" text="Compile-time + Runtime" />

Simple `not` clauses narrow the inferred type:

<<< ../../examples/docs/constraint-brands/25-not-exclusion.ts

### `propertyNames: { enum }` strict keys <Badge type="info" text="Compile-time" />

When `propertyNames` specifies an enum, the object keys are narrowed to that union:

<<< ../../examples/docs/constraint-brands/16-property-names-enum.ts

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

<<< ../../examples/docs/constraint-brands/17-pattern-properties.ts

Multiple `patternProperties` entries are intersected so each pattern enforces its own value type.

### `if/then/else` generalised narrowing <Badge type="warning" text="Compile-time + Runtime" />

`if/then/else` narrowing recognises three property forms in `if.properties`: `{ const: V }`, `{ enum: [...] }`, and `{ type: 'string' | 'number' | ... }`. Multi-property discriminators intersect all literals at once. Every property in `if.properties` must appear in `required` for narrowing to apply; otherwise the inferred type is the union of both branches.

For a single const discriminator:

<<< ../../examples/docs/constraint-brands/18-ifthenelse-discriminator.ts

Multi-property discriminator example:

<<< ../../examples/docs/constraint-brands/19-multi-discriminator.ts

### `dependentRequired` conditional typing <Badge type="warning" text="Compile-time + Runtime" />

Modeled as a per-trigger union. When the trigger key is present, all its dependents become required:

<<< ../../examples/docs/constraint-brands/20-dependent-required.ts

## `uniqueItems` tuple distinctness <Badge type="warning" text="Compile-time + Runtime" />

`uniqueItems: true` is enforced at two compile-time levels depending on the array shape:

1. **Homogeneous arrays** - the inferred type carries `UniqueArrayBrandInterface<T>` (a generic uniqueness brand parameterised by element type). A plain `T[]` cannot satisfy it; values must come through `JsonTology.instantiate` / coerce / `materialize`.

2. **Literal-typed tuples** (≤ 8 elements via `prefixItems`) - `UniqueTuplePairwiseType` runs a pairwise overlap check at the type level and collapses the tuple to `never` when any pair of element types overlaps. This means `{ prefixItems: [{ const: 'red' }, { const: 'red' }], uniqueItems: true }` is a compile-time error.

Above 8 elements the pairwise check is skipped and runtime validation still enforces `uniqueItems`.

> **Note:** Compile-time tuple pairwise checking applies only to literal-typed tuples declared via `prefixItems` with ≤ 8 elements. Homogeneous arrays (e.g. `string[]`) receive only the `UniqueArrayBrandInterface<T>` brand and rely on runtime enforcement for actual uniqueness - there is no compile-time element-by-element comparison for homogeneous arrays.

<<< ../../examples/docs/constraint-brands/21-unique-items-tuple.ts

## `tightStringLengths` opt-in narrowing <Badge type="info" text="Compile-time" />

When a project augments `JsonTologyTypeConfigInterface` with `'tightStringLengths': true`, `InferType` narrows strings whose `minLength`/`maxLength` bounds are within `StringLengthCap = 8` to a union of fixed-length character template literals.

<!-- inline-ts-ok: .d.ts module augmentation; must live in the consumer project's tsconfig include path and cannot run from examples/. -->
```ts
// json-tology.d.ts — opt in to tight string length narrowing
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface { 'tightStringLengths': true }
}
```

<<< ../../examples/docs/constraint-brands/22-three-char-template.ts
<<< ../../examples/docs/constraint-brands/23-variable-length-template.ts

Bounds above the cap (or with the flag disabled) fall back to plain `string`. The flag is default-off so existing schemas pay no compile cost.

## See also

- [Branded Keywords](./keywords) - string, number, array, object, and nominal brands
- [Type Inference](/types/infer) - how `InferType` resolves narrowings and brand intersections
- [Composition - discriminated union](/composition/discriminated-union) - `if/then/else` in schema composition
- [Bookstore domain](/bookstore-domain) - real-world narrowing examples
