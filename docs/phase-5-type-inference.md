# Phase 5: Project-Owned Type Inference

## Goal

Replace dependency on `json-schema-to-ts` with a project-owned type inference system that can handle the full range of json-tology's semantic capabilities, including transforms, brands, composition, and graph-level concepts.

## Current State

- Type inference delegates entirely to `FromSchema` from `json-schema-to-ts`.
- `Infer<T>` wraps `FromSchema<T>` with an `IsAny` guard.
- Transform types use phantom brands (`TRANSFORM_OUT`, `CATCH_BRAND`) layered on top of `FromSchema`.
- Composition types (`ExtendSchema`, `PartialSchema`, etc.) in `src/types/compose.ts` manually construct schema-like types and rely on `FromSchema` to resolve them.
- `json-schema-to-ts` has known limitations: partial `not` support, no awareness of transforms/brands, limited `if/then/else` narrowing.

## Tasks

### 5.1 — Audit current `FromSchema` coverage

Before replacing, catalog exactly what `FromSchema` handles correctly in the test suite:

- Primitive types
- Objects with required/optional properties
- Arrays with items/prefixItems
- `$ref` / `$defs` resolution
- allOf / anyOf / oneOf
- enum / const
- Nested compositions
- additionalProperties

Document what breaks or produces `any`/`unknown` unexpectedly.

### 5.2 — Build project-owned `InferSchema<T>` type

Create `src/types/infer.ts` with a from-scratch conditional type implementation:

```typescript
type InferSchema<T extends JSONSchemaDefinition> =
  T extends { type: 'string' } ? string :
  T extends { type: 'number' } ? number :
  T extends { type: 'integer' } ? number :
  T extends { type: 'boolean' } ? boolean :
  T extends { type: 'null' } ? null :
  T extends { type: 'array'; items: infer I } ? InferSchema<I>[] :
  T extends { type: 'object'; properties: infer P } ? InferObject<P, T> :
  // ... composition, refs, const, enum
  unknown;
```

Key advantages over `FromSchema`:
- Direct awareness of transform brands
- Direct awareness of composition helpers
- Direct handling of `if/then/else` narrowing
- No third-party dependency for core type behavior

### 5.3 — Implement $ref resolution at type level

Handle `{ $ref: '#/$defs/Foo' }` by looking up the definition in the schema's `$defs`:

```typescript
type ResolveRef<T, Root> =
  T extends { $ref: `#/$defs/${infer K}` }
    ? Root extends { $defs: { [key in K]: infer D } } ? InferSchema<D> : unknown
    : T;
```

External refs (absolute URIs) would fall back to `unknown` at the type level, with runtime validation still enforced.

### 5.4 — Integrate with transform/brand types

Make `InferSchema` aware of phantom brands:

```typescript
type InferSchema<T> =
  T extends TransformBrand<infer Out> ? Out :
  T extends BrandedSchema<infer Base, infer Brand> ? InferSchema<Base> & { __brand: Brand } :
  // ... normal inference
```

### 5.5 — Gradual migration

- Add `InferSchema` alongside `FromSchema`.
- Run type-level tests comparing outputs.
- Switch `Infer<T>` to use project-owned inference once coverage matches.
- Keep `json-schema-to-ts` as a devDependency for comparison testing until fully migrated.

## Validation

- Type-level tests using `expectType` / `tsd` or inline `satisfies` checks.
- Verify all existing typed API signatures continue to work.
- No runtime changes — this is purely compile-time.

## Files Changed

- New: `src/types/infer.ts` — project-owned inference engine
- `src/types/schema.ts` — switch `Infer` to use new engine
- `src/types/compose.ts` — simplify composition types
- `src/types/transform.ts` — integrate with inference
- New: `test/types/inference.test-d.ts` — type-level tests
- `package.json` — eventually remove `json-schema-to-ts` from `dependencies`

## Dependency

Independent of Phases 1–4. Can proceed in parallel. Should be the last phase to complete since runtime behavior is unaffected.
