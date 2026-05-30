---
title: Primary Inference Types
description: InferType, InferSchemaType, and constraint brands - compile-time TypeScript type derivation from JSON Schema literals.
---

# Primary Inference Types <Badge type="info" text="Compile-time" />

> This page covers `InferType`, `InferSchemaType`, and constraint brands. All examples use the [bookstore domain](/bookstore-domain). See [Schemas](/schemas) for how schemas are registered.

json-tology derives TypeScript types from `as const` JSON Schema literals at compile time. No code generation. No separate type declarations. The types flow through `instantiate()`, `is()`, and the registry type map automatically.

See also [Utility types](./utility.md), [Range types](./ranges.md).

---

## InferType

Derives a TypeScript type from an `as const` JSON Schema literal.

### Signature

<RunnableExample src="examples/docs/types/45-infertype-signature" />

### When to use

Use `InferType<T>` everywhere you need the TypeScript type corresponding to a schema. It handles objects, arrays, enums, `const`, `$ref`, `oneOf`, `allOf`, `if/then/else`, and composition. Use `InferSchemaType<T, Root, Refs>` directly only when you need to specify a different root schema for `$ref` resolution within a sub-schema.

### Examples

#### Example 1: Object schema with required and optional fields

<RunnableExample src="examples/docs/types/01-infer-type" />

The `addresses` array has `default: []` in the schema - at the type level it remains optional because `default` is a runtime concept; at runtime `instantiate()` always fills it in.

#### Example 2: Integer range, enum, and const

<RunnableExample src="examples/docs/types/46-infertype-range-enum-const" />

Bounded `integer` schemas with both bounds in the 0-50 range automatically produce literal unions. See [Constraint Brands](/constraint-brands/narrowing#structural-narrowing) for details on integer ranges and multipleOf ranges.

#### Example 3: Cross-schema `$ref` resolution

When a schema references another by absolute IRI, pass a reference map as the second type argument.

<RunnableExample src="examples/docs/types/47-infertype-cross-schema-refs" />

Without the reference map, `items` would resolve to `unknown` at the element level.

### Comparison

::: code-group

```ts [json-tology]
import type { InferType } from 'json-tology/types';

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

# Python type annotations ARE the schema  - no separate inference step.
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

- [Constraint Brands](/constraint-brands) - format, string, numeric, array brands
- `InferSchemaType` - explicit root control for sub-schema inference
- [Schemas](/schemas) - how schemas are registered

---

## InferSchemaType

Lower-level inference with explicit `Root` and `Refs` parameters. Resolves `$ref` against the specified root schema.

### Signature

<RunnableExample src="examples/docs/types/48-inferschematype-signature" />

### When to use

Use when you need to infer the type of a sub-schema that uses `$ref: '#/$defs/...'` pointing into a larger parent schema. `InferType<T>` calls `InferSchemaType<T, T>` automatically - explicit use is only needed when the sub-schema and the root are different objects.

### Examples

#### Example 1: Infer a sub-schema type from $defs

<RunnableExample src="examples/docs/types/49-inferschematype-defs-sub" />

### Comparison

::: code-group

```ts [json-tology]
type Sub = InferSchemaType<typeof SubSchema, typeof RootSchema>;
```

```ts [Zod]
// Not applicable  - Zod types are derived per-schema, not from a root.
// Nested types are inferred via z.infer<typeof SubSchema>.
```

```ts [TypeBox]
// TypeBox infers from the sub-object directly using Static<T>.
// No explicit root concept.
```

```ts [AJV]
// Not applicable  - AJV provides no TypeScript inference.
```

```py [Pydantic]
# Not applicable  - Python uses class-based types, not JSON Pointer sub-schemas.
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

---

## Constraint brands

json-tology surfaces JSON Schema constraint keywords as compile-time phantom brands. Two values with different constraints produce structurally incompatible TypeScript types.

The only way to obtain a branded value is through the validation API (`instantiate`, `is`, `materialize`, etc.), which enforces that data has passed runtime checks before being treated as a constrained type.

See [Constraint Brands](/constraint-brands) for the full reference, configuration flags, and structural narrowing features.

### Examples

#### Example 1: Format brands prevent mixing email and UUID strings

<RunnableExample src="examples/docs/types/50-brands-format-incompatible" />

#### Example 2: Integer range as literal union

<RunnableExample src="examples/docs/types/51-brands-integer-range-literal" />

#### Example 3: Disable brands for a project

Create a `.d.ts` anywhere in your `tsconfig include` path:

<RunnableExample src="examples/docs/types/52-brands-disable-config" />

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
// Must be applied manually per schema  - not automatic from JSON Schema keywords.
```

```ts [TypeBox]
// TypeBox does not generate phantom brands from JSON Schema constraints.
// All string schemas infer as string.
type Email = Static<typeof EmailSchema>; // string
```

```ts [AJV]
// AJV provides no type inference  - no brands possible.
```

```py [Pydantic]
# Pydantic v2 supports Annotated types for similar constraint propagation:
from pydantic import EmailStr
from typing import Annotated

class Customer(BaseModel):
    email: EmailStr  # validated as email at runtime, typed as str
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

- [Constraint Brands](/constraint-brands) - full brand reference and configuration
- `Transform.brand` - explicit nominal brands on schema `$id`
