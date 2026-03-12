# Phase 5: Project-Owned Type Inference — Implementation Plan

## Scope

Replace all uses of `FromSchema` from `json-schema-to-ts` with a project-owned `InferSchema<T>` type. Move `json-schema-to-ts` from `dependencies` to `devDependencies` (keep temporarily for comparison testing), then remove entirely.

## Migration Surface

10 source files import from `json-schema-to-ts`:

| File | Imports | Usage |
|------|---------|-------|
| `src/types/schema.ts` | `FromSchema`, `JSONSchema` | `Infer<T>`, `InferSchema<T>` |
| `src/types/compose.ts` | `JSONSchema` | Composition type constraints |
| `src/types/transform.ts` | `FromSchema`, `JSONSchema` | `ParseOutput<T>` |
| `src/types/brand.ts` | (indirect via transform) | `BrandOutput<T>` |
| `src/types/BaseTypes.ts` | `FromSchema`, `JSONSchema` | 9 derived types, factory functions |
| `src/schema/SchemaRegistry.ts` | `FromSchema`, `JSONSchema` | `parse()`, `safeParse()` signatures |
| `src/schema/Materializer.ts` | `FromSchema`, `JSONSchema` | `materialize()` signature |
| `src/schema/Transform.ts` | `JSONSchema` | `create()`, `brand()`, `pipe()`, `withCatch()` constraints |
| `src/schema/Compose.ts` | `JSONSchema` | All composition method constraints |
| `src/schema/Value.ts` | `JSONSchema` | All value method constraints |
| `src/JsonTology.ts` | `FromSchema`, `JSONSchema` | `materialize()`, `parse()`, `safeParse()` signatures |

## Step-by-Step Implementation

### Step 1: Create `src/types/json-schema.ts` — Project-Owned `JSONSchema` Type

Replace the re-exported `JSONSchema` from `json-schema-to-ts` with a project-owned definition. This is the constraint type used in generics (`T extends JSONSchema`).

```typescript
// Minimal JSON Schema type definition for use as a generic constraint.
// This must accept any valid JSON Schema object declared with `as const`.
type JSONSchemaObject = {
  readonly [key: string]: unknown;
};

type JSONSchemaDefinition = boolean | JSONSchemaObject;

// Public constraint type — used in `T extends JSONSchema`
export type JSONSchema = JSONSchemaDefinition;
```

This is intentionally loose — it's a generic constraint, not a validator. The tight inference happens in `InferSchema<T>`.

### Step 2: Create `src/types/infer.ts` — The Core Inference Engine

This is the main deliverable. A pure conditional type that maps `as const` schema literals to TypeScript types.

#### 2a: Primitives

```typescript
type InferPrimitive<T> =
  T extends { readonly type: 'string' } ? string :
  T extends { readonly type: 'number' } ? number :
  T extends { readonly type: 'integer' } ? number :
  T extends { readonly type: 'boolean' } ? boolean :
  T extends { readonly type: 'null' } ? null :
  never;
```

#### 2b: Const and Enum

```typescript
type InferConst<T> =
  T extends { readonly const: infer V } ? V : never;

type InferEnum<T> =
  T extends { readonly enum: readonly (infer V)[] } ? V : never;
```

#### 2c: Arrays

```typescript
type InferArray<T, Root> =
  T extends { readonly type: 'array'; readonly items: infer I }
    ? InferSchema<I, Root>[]
    : T extends { readonly type: 'array'; readonly prefixItems: readonly [...infer P] }
      ? { [K in keyof P]: InferSchema<P[K], Root> }
      : T extends { readonly type: 'array' }
        ? unknown[]
        : never;
```

#### 2d: Objects

```typescript
type InferObject<T, Root> =
  T extends { readonly type: 'object'; readonly properties: infer P }
    ? InferObjectProps<P, ExtractRequiredKeys<T>, Root> & InferAdditional<T, Root>
    : T extends { readonly type: 'object' }
      ? Record<string, unknown>
      : never;

type InferObjectProps<P, R extends string, Root> =
  { [K in keyof P & R]: InferSchema<P[K], Root> } &
  { [K in Exclude<keyof P, R>]?: InferSchema<P[K], Root> };

type ExtractRequiredKeys<T> =
  T extends { readonly required: readonly (infer K extends string)[] } ? K : never;

type InferAdditional<T, Root> =
  T extends { readonly additionalProperties: false } ? {} :
  T extends { readonly additionalProperties: infer A } ? { [key: string]: InferSchema<A, Root> } :
  {};
```

#### 2e: Composition

```typescript
type InferAllOf<T, Root> =
  T extends { readonly allOf: readonly [infer A, ...infer Rest] }
    ? InferSchema<A, Root> & InferAllOf<{ readonly allOf: Rest }, Root>
    : {};

type InferAnyOf<T, Root> =
  T extends { readonly anyOf: readonly (infer V)[] }
    ? InferSchema<V, Root>
    : never;

type InferOneOf<T, Root> =
  T extends { readonly oneOf: readonly (infer V)[] }
    ? InferSchema<V, Root>
    : never;
```

#### 2f: $ref / $defs Resolution

```typescript
type InferRef<T, Root> =
  T extends { readonly $ref: `#/$defs/${infer K}` }
    ? Root extends { readonly $defs: { readonly [key in K]: infer D } }
      ? InferSchema<D, Root>
      : unknown
    : T extends { readonly $ref: '#' }
      ? InferSchema<Root, Root>  // self-reference
      : unknown;  // external refs fall back to unknown
```

#### 2g: Nullable (type arrays)

```typescript
type InferTypeArray<T, Root> =
  T extends { readonly type: readonly (infer U extends string)[] }
    ? InferSingleType<U, T, Root>
    : never;

type InferSingleType<U extends string, T, Root> =
  U extends 'string' ? string :
  U extends 'number' ? number :
  U extends 'integer' ? number :
  U extends 'boolean' ? boolean :
  U extends 'null' ? null :
  U extends 'array' ? InferArray<T, Root> :
  U extends 'object' ? InferObject<T, Root> :
  never;
```

#### 2h: Master Dispatcher

```typescript
export type InferSchema<T, Root = T> =
  // Phase 1: Transform/Brand phantom types (peel off first)
  T extends TransformBrand<infer Out> ? Out :
  // Phase 2: Const/Enum literals
  T extends { readonly const: unknown } ? InferConst<T> :
  T extends { readonly enum: readonly unknown[] } ? InferEnum<T> :
  // Phase 3: $ref
  T extends { readonly $ref: string } ? InferRef<T, Root> :
  // Phase 4: Composition
  T extends { readonly allOf: readonly unknown[] } ? InferAllOf<T, Root> :
  T extends { readonly anyOf: readonly unknown[] } ? InferAnyOf<T, Root> :
  T extends { readonly oneOf: readonly unknown[] } ? InferOneOf<T, Root> :
  // Phase 5: Type-based
  T extends { readonly type: readonly unknown[] } ? InferTypeArray<T, Root> :
  T extends { readonly type: 'array' } ? InferArray<T, Root> :
  T extends { readonly type: 'object' } ? InferObject<T, Root> :
  InferPrimitive<T> extends never ? unknown : InferPrimitive<T>;
```

### Step 3: Update `src/types/schema.ts`

```typescript
import type { InferSchema } from './infer.js';
export type { JSONSchema } from './json-schema.js';

export type Infer<TSchema> = InferSchema<TSchema>;

/** @deprecated Use Infer<T> instead. */
export type InferSchemaLegacy<TSchema> = InferSchema<TSchema>;
```

### Step 4: Update `src/types/transform.ts`

Replace `FromSchema<JSONSchema & TSchema>` with `InferSchema<TSchema>`:

```typescript
export type ParseOutput<TSchema>
  = TSchema extends TransformBrand<infer Out> ? Out : InferSchema<TSchema>;
```

### Step 5: Update `src/types/compose.ts`

Remove `import type { JSONSchema } from 'json-schema-to-ts'`, replace with project-owned `JSONSchema`.

The composition types (`ExtendSchema`, `PartialSchema`, etc.) keep their current structure — they produce schema-shaped types that `InferSchema` can resolve through.

### Step 6: Update `src/types/BaseTypes.ts`

Replace all `FromSchema<typeof XDef>` with `Infer<typeof XDef>`. Replace `JSONSchema` import.

### Step 7: Update runtime files

For all 6 runtime files (`SchemaRegistry`, `Materializer`, `Transform`, `Compose`, `Value`, `JsonTology`):
- Replace `import type { JSONSchema } from 'json-schema-to-ts'` with `import type { JSONSchema } from '../types/json-schema.js'`
- Replace `FromSchema<TSchema>` with `InferSchema<TSchema>` in method signatures

### Step 8: Create `test/types/inference.test.ts`

Type-level tests using `@ts-expect-error` and `satisfies`:

```typescript
import type { Infer } from '../../src/types/schema.js';

// Primitives
const _s: Infer<typeof StringSchema> = 'hello';  // should compile
// @ts-expect-error — number is not string
const _bad: Infer<typeof StringSchema> = 42;

// Objects with required/optional
const _u: Infer<typeof UserSchema> satisfies { name: string; email: string; age?: number };

// Const
const _c: Infer<typeof CircleKindSchema> = 'circle' as const;

// Enum
const _e: Infer<typeof SortOrderSchema> satisfies 'asc' | 'desc';

// Arrays
const _a: Infer<typeof StringArraySchema> satisfies string[];

// allOf
const _i: Infer<typeof IntersectionSchema> satisfies { a: string } & { b: number };

// anyOf/oneOf
const _u2: Infer<typeof UnionSchema> satisfies string | number;

// $ref/$defs
const _r: Infer<typeof SchemaWithRef> satisfies { child: { name: string } };

// Transform phantom
const _t: ParseOutput<typeof DateSchema> satisfies Date;

// Composition utilities
const _p: Infer<typeof PartialUserSchema> satisfies { name?: string; email?: string };
```

This file doesn't need to "run" — it just needs to compile without errors.

### Step 9: Move `json-schema-to-ts` to devDependencies

In `package.json`, move `"json-schema-to-ts": "^3.1.1"` from `dependencies` to `devDependencies`. Keep it temporarily for regression comparison.

### Step 10: Remove `json-schema-to-ts` entirely

Once all type tests pass without it, remove from `devDependencies` and delete any remaining imports.

## Key Design Decisions

1. **`Root` type parameter**: Every `InferSchema<T, Root>` carries the root schema for $ref resolution. Defaults to `T` itself at the entry point.

2. **Transform peeling first**: `InferSchema` checks for `TransformBrand` before anything else, so transformed schemas return the decoded type.

3. **Graceful degradation**: Unknown constructs produce `unknown`, never `any`. This is safer than `FromSchema`'s behavior.

4. **Composition types stay as-is**: The `Omit & { ... }` pattern in `ExtendSchema` etc. should work with `InferSchema` because our engine can pattern-match through intersections — unlike `FromSchema` which needs exact shapes.

5. **No runtime changes**: This entire phase is compile-time only. No `.js` files change behavior.

## Risk Mitigation

- **Type recursion limits**: TypeScript has a max type instantiation depth (~50). Deep allOf/anyOf nesting or deep $ref chains may hit this. Mitigation: add a depth counter type parameter that bails to `unknown`.
- **Composition type opacity**: If `InferSchema` can't see through `Omit<T, K> & { ... }`, the composition utilities may need to be restructured to preserve the literal schema shape. Test this early.
- **Performance**: Complex conditional types can slow `tsc`. Profile with the full test suite after implementation.

## Files Changed

| File | Action |
|------|--------|
| `src/types/json-schema.ts` | **New** — project-owned JSONSchema type |
| `src/types/infer.ts` | **New** — core inference engine |
| `src/types/schema.ts` | Rewrite — use InferSchema, drop FromSchema |
| `src/types/transform.ts` | Update — use InferSchema |
| `src/types/brand.ts` | Update import if needed |
| `src/types/compose.ts` | Update import |
| `src/types/BaseTypes.ts` | Replace FromSchema with Infer |
| `src/types/index.ts` | Add exports |
| `src/schema/SchemaRegistry.ts` | Replace imports |
| `src/schema/Materializer.ts` | Replace imports |
| `src/schema/Transform.ts` | Replace imports |
| `src/schema/Compose.ts` | Replace imports |
| `src/schema/Value.ts` | Replace imports |
| `src/JsonTology.ts` | Replace imports |
| `test/types/inference.test.ts` | **New** — type-level tests |
| `package.json` | Move/remove json-schema-to-ts |

## Execution Order

Steps 1-2 can be developed standalone. Steps 3-7 are a coordinated migration (do together). Steps 8-10 are validation and cleanup.

Critical path: Step 2 (the inference engine) is the hardest part. Everything else is mechanical.
