# Type Inference Audit: `FromSchema` / `json-schema-to-ts` v3.1.x

**Date:** 2026-03-11
**Phase:** 5.1 — Audit of current type inference coverage

---

## 1. What `FromSchema` Handles Correctly

Based on the test suite and source code, the following patterns work as expected when schemas are declared with `as const`:

### Primitive types
```ts
{ type: 'string' }           // => string
{ type: 'number' }           // => number
{ type: 'integer' }          // => number
{ type: 'boolean' }          // => boolean
```
Used throughout the test suite (e.g., `value.test.ts`, `jsonTology.test.ts`).

### Object types with `properties` and `required`
```ts
const UserSchema = {
  type: 'object',
  properties: {
    name:  { type: 'string' },
    email: { type: 'string' },
    age:   { type: 'number' },
  },
  required: ['name', 'email'],
} as const;
// => { name: string; email: string; age?: number }
```
This is the dominant pattern in the codebase (see `compose.test.ts`, `compose2.test.ts`, `jsonTology.test.ts`, `materializer.test.ts`).

### `const` keyword (literal types)
```ts
{ const: 'circle' }  // => 'circle'
```
Used in discriminated union tests (`compose.test.ts` lines 111-119).

### `default` keyword
The `default` keyword is correctly preserved in schema objects and used at runtime by the materializer and `Value.cast()`. `FromSchema` infers the property type (not the default value type).

### `enum` keyword
Supported by `json-schema-to-ts` (not explicitly tested in this codebase but documented as working).

### `additionalProperties: false`
Used in `compose.test.ts` (`PersonSchema`). `FromSchema` correctly narrows the object to only declared keys.

### Array types with `items`
```ts
{ type: 'array', items: { type: 'string' } }  // => string[]
```
Used in `baseTypes.test.ts` (PageSchema items), `jsonTology.test.ts` (DirectorySchema employees).

---

## 2. What Produces `any` or `unknown` Unexpectedly

### Generic `JSONSchema` typed parameters
When a schema is typed as `JSONSchema` (the union type) rather than a narrow `as const` literal, `FromSchema<JSONSchema>` resolves to `any`. The project's `Infer<T>` type (`src/types/schema.ts`) explicitly guards against this:

```ts
export type Infer<TSchema extends JSONSchema>
  = IsAny<FromSchema<TSchema>> extends true ? unknown : FromSchema<TSchema>;
```

This is a critical design-level issue: any function that accepts `JSONSchema` as a parameter type (rather than a generic `T extends JSONSchema`) will lose all type information.

### `as any` escape hatches in tests
The test suite uses `as any` in several places where the inferred type is insufficient:
- `compose.test.ts`: `(s as any).required`, `(result as any).allOf`, `(result as any).oneOf`, `(result as any).discriminator` -- composition utilities return types that `FromSchema` cannot see through.
- `compose2.test.ts`: `(s as any).required` -- same pattern for `partial()`, `required()`, `omit()`.
- `materializer.test.ts`: `as unknown as string`, `as unknown as number`, `as unknown as never` -- type assertions needed to test runtime coercion paths.
- `schemaRegistry.test.ts`: `as any` on parse results.
- `transform.test.ts`: `@ts-expect-error` and `as any` for encode without transform.

These are signals that the composition types and runtime APIs produce types that do not flow through `FromSchema` cleanly.

### `$ref` and `$defs`
The `DirectorySchema` in `jsonTology.test.ts` uses `$ref: '#/$defs/Employee'`. `FromSchema` can resolve local `$defs` references, but the resulting type loses structural detail when schemas are composed or passed through runtime functions. The test accesses results via `as Record<string, unknown>` throughout.

---

## 3. Known Limitations of `json-schema-to-ts` v3.x

| Limitation | Impact |
|---|---|
| **`as const` required** | Schemas loaded from JSON files, APIs, or variables typed as `JSONSchema` produce `any` or `never`. |
| **Recursive schemas unsupported** | `FromSchema` cannot handle self-referential `$ref` (e.g., a tree node referencing itself). TypeScript types cannot maintain internal state for circular resolution. |
| **`oneOf` treated as `anyOf`** | TypeScript lacks refinement types, so `FromSchema` cannot discriminate `oneOf` variants -- it produces a union identical to `anyOf`. Compile-time rejection of invalid objects is not possible. |
| **`if`/`then`/`else` off by default** | Conditional schema keywords are not parsed unless `parseIfThenElseKeywords` option is enabled. |
| **`not` keyword off by default** | The `not` keyword is not parsed unless `parseNotKeyword` option is enabled. |
| **`unevaluatedProperties` ignored** | Does not type extra properties when used alone; `additionalProperties` must be used instead. |
| **Extra properties always `unknown`** | When `additionalProperties` is used alongside `properties`, extra properties are typed `unknown` to avoid conflicts. |
| **Cross-schema `$ref` unsupported** | `FromSchema` only resolves `$ref` within local `$defs`. External URI references (e.g., `{ $ref: 'https://example.com/Other' }`) are not resolved. Requires the `references` option with manually supplied schemas. |
| **`patternProperties` limited** | Keys matched by pattern are typed loosely. |
| **Format keyword ignored** | `format: 'date-time'`, `format: 'email'`, etc. have no effect on the inferred type (always `string`). |

---

## 4. Transform/Brand Phantom Types and `FromSchema` Interaction

### Transform (`src/types/transform.ts`)
`Transformed<TSchema, TOut>` is defined as `TransformBrand<TOut> & TSchema`. This is a phantom intersection: at runtime the schema object is unchanged, but the TypeScript type carries a `[TRANSFORM_OUT]: TOut` brand.

- `Infer<Transformed<S, TOut>>` still returns `FromSchema<S>` (the JSON-level type). This is correct -- the transform output is a separate concern.
- `ParseOutput<Transformed<S, TOut>>` correctly extracts `TOut` via conditional type.
- **Gap:** There is no compile-time enforcement that `TOut` is compatible with the decode function's return type. The user must ensure consistency manually.

### WithCatch (`src/types/transform.ts`)
`WithCatchSchema<TSchema, TFallback>` is `CatchBrand<TFallback> & TSchema`. Same phantom pattern.

- The fallback type `TFallback` is not validated against `FromSchema<TSchema>` at the type level. A user could provide a fallback of the wrong shape without a type error.

### Brand (`src/types/brand.ts`)
`Branded<TSchema, TBrand>` is `BrandTag<TBrand> & TSchema`. `BrandOutput<TSchema>` produces `ParseOutput<TSchema> & { readonly brand: B }`.

- **Gap:** The `brand` field is a structural property on the output type, not a true unique symbol brand. Two different brand names sharing the same base type are not mutually exclusive at the type level (they differ only by the literal `brand` string, which is still structurally matchable).
- `FromSchema` is unaffected by brand tags since they are phantom intersections.

### Overall assessment
The phantom type layering is sound in principle -- `FromSchema` sees through the intersection to the original schema. However, the project currently lacks compile-time type tests (`tsd`, `@ts-expect-error` assertions, or `expectTypeOf`) to verify that `Infer`, `ParseOutput`, and `BrandOutput` produce the expected types. The single `@ts-expect-error` in `transform.test.ts` is a runtime-behavior guard, not a type-level assertion.

---

## 5. Composition Type Accuracy

### `ExtendSchema`
Defined as `Omit<TSchema, '$id' | 'properties'> & { readonly '$id': TId; readonly 'properties': ... }`.

- **Problem:** `FromSchema` cannot infer through `Omit & { ... }` intersections. The resulting type is opaque to `FromSchema`, which expects a specific shape. Tests use `as any` to access `required` on extended schemas, confirming the type is lost.

### `PartialSchema`
Strips `required` via `Omit<TSchema, '$id' | 'required'>`.

- **Problem:** Same issue -- `Omit` destroys the literal type structure that `FromSchema` needs. `Infer<PartialSchema<T, Id>>` will not produce `Partial<Infer<T>>`.

### `RequiredSchema`
Adds `required: ReadonlyArray<keyof ExtractProperties<TSchema>>`.

- **Problem:** The reconstructed `required` array type is `ReadonlyArray<string>` (widened from keyof), not a literal tuple. `FromSchema` needs literal tuples for required inference.

### `PickSchema` / `OmitSchema`
Use `Pick` / `Omit` on `ExtractProperties<TSchema>`.

- **Problem:** `Pick<ExtractProperties<S>, K>` produces a new mapped type that `FromSchema` cannot traverse. The structural relationship to the original schema is severed.

### `IntersectionSchema` (allOf)
Wraps schemas in `{ allOf: TSchemas }`.

- **Partially works:** `FromSchema` does support `allOf` and can intersect the inferred types of constituent schemas. However, the generic `readonly JSONSchema[]` tuple type may widen, losing individual schema types.

### `DiscriminatedUnionSchema` (oneOf)
Wraps schemas in `{ oneOf: TVariants }`.

- **Partially works:** `FromSchema` treats `oneOf` as `anyOf` (union). Discrimination is not enforced at the type level.

### Summary
All composition utilities produce schema-like objects that are **valid JSON Schema at runtime** but whose TypeScript types are **opaque to `FromSchema`**. The composition type helpers are structurally correct for schema manipulation but do not preserve the narrow literal types required for `FromSchema` inference.

---

## 6. Recommendations for a Project-Owned Inference Engine

A custom `Infer<T>` replacement must handle the following to meet json-tology's architectural requirements:

### Must-have (P0)

1. **Primitive type mapping** -- `string`, `number`, `integer`, `boolean`, `null`, `array`, `object`.
2. **Object property inference** with `required` awareness (optional vs. mandatory fields).
3. **`const` and `enum` literal types**.
4. **`$ref` / `$defs` local resolution** -- resolve `#/$defs/Foo` references within the same schema tree. This must work recursively (self-referencing schemas via lazy type references).
5. **Composition keywords** -- `allOf` (intersection), `anyOf` / `oneOf` (union). `oneOf` should ideally produce a discriminated union when a `discriminator` annotation is present.
6. **`additionalProperties: false`** -- narrow object type to declared keys only.
7. **Composition utility pass-through** -- `ExtendSchema`, `PartialSchema`, `RequiredSchema`, `PickSchema`, `OmitSchema` must produce types that the inference engine can resolve, not opaque `Omit` intersections.
8. **Transform/Brand phantom type preservation** -- the engine must ignore phantom brands when computing the base JSON type, but `ParseOutput` / `BrandOutput` must still compose correctly.

### Should-have (P1)

9. **`if`/`then`/`else` conditionals** -- narrow the type based on conditional branches.
10. **`not` keyword** -- exclude specific types from unions.
11. **Cross-schema `$ref` resolution** -- resolve references to external schema `$id` URIs, using the registry as context. This would require a second type parameter (a schema map).
12. **`format` keyword awareness** -- optionally map `format: 'date-time'` to `Date` (via transform), `format: 'uri'` to branded string, etc.
13. **`patternProperties`** -- infer index signature types from pattern-matched keys.
14. **Tuple types** -- `items` as array with `prefixItems` support.

### Nice-to-have (P2)

15. **`dependentRequired` / `dependentSchemas`** -- conditional required fields.
16. **`unevaluatedProperties`** -- proper handling in subschema composition.
17. **Read-only / write-only** split -- different types for input vs. output (mirrors `readOnly` / `writeOnly` keywords).
18. **Error messages as types** -- when inference fails, produce a descriptive error type rather than `unknown` or `never`.

### Architecture constraints

- The inference engine must be a pure type-level computation (no runtime code).
- It must accept `as const` schema literals and produce concrete types.
- It should degrade gracefully: unknown constructs should produce `unknown`, never `any`.
- It should compose with `ParseOutput` and `BrandOutput` without special-casing.
- It should be testable via `tsd` or equivalent compile-time assertion library.

---

## Appendix: Test Coverage Gaps

The current test suite has **zero compile-time type assertions**. All tests are runtime-only (`node:test` + `node:assert`). This means:

- No verification that `Infer<typeof UserSchema>` produces `{ name: string; email: string; age?: number; active?: boolean }`.
- No verification that `ParseOutput<Transformed<S, Date>>` produces `Date`.
- No verification that `BrandOutput<Branded<S, 'UserId'>>` produces `string & { brand: 'UserId' }`.
- No verification that composition utilities preserve inference.

**Recommendation:** Before building a custom inference engine, add a `test/types/` directory with `tsd` or `@ts-expect-error`-based type assertions for every type alias in `src/types/`. This establishes a regression baseline.
