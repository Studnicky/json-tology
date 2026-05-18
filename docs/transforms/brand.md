# `Transform.brand` <Badge type="info" text="Compile-time" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Attaches a compile-time nominal brand string to a schema's TypeScript type. Returns the same schema object at runtime - no WeakMap entry is created, no runtime effect. The TypeScript return type becomes `BrandedType<TSchema, TBrand>`, which intersects the inferred type with `{ readonly brand: TBrand }`. Access the branded type via `BrandOutputType<typeof schema>`.

**Use this when** you need nominally distinct types for identifiers that are structurally identical at runtime - `CustomerId` and `OrderId` are both UUID strings, but TypeScript should refuse to let you pass one where the other is expected. This prevents mixing up ID fields from different entity types.

**Don't use this when** you need an automatic decode/encode transformation (use [`Transform.create`](/transforms/decode-encode)). Don't use it for automatic runtime validation beyond what JSON Schema already provides - `brand` is purely a compile-time marker.

## Examples

### Example 1: Nominally distinct Customer and Order IDs

<<< ../../examples/docs/transforms/07-brand-nominal-ids.ts

### Example 2: Branded ISBN for books

<<< ../../examples/docs/transforms/08-brand-isbn.ts

## Bad examples - what NOT to do

### Anti-pattern 1: Applying brand after the schema has been registered

<<< ../../examples/docs/transforms/09-brand-register-order.ts

## Comparison

::: code-group

```ts [json-tology]
const CustomerIdSchema = Transform.brand(
  { $id: 'https://bookstore.example/CustomerId', type: 'string', format: 'uuid' } as const,
  'CustomerId',
);
type CustomerId = BrandOutputType<typeof CustomerIdSchema>;
// string & { readonly brand: 'CustomerId' }
```

```ts [Zod]
const CustomerIdSchema = z.string().uuid().brand<'CustomerId'>();
type CustomerId = z.infer<typeof CustomerIdSchema>;
// string & z.BRAND<'CustomerId'>
```

```ts [Valibot]
import * as v from 'valibot';
const CustomerIdSchema = v.pipe(v.string(), v.uuid(), v.brand('CustomerId'));
type CustomerId = v.InferOutput<typeof CustomerIdSchema>;
// string with brand 'CustomerId'
```

```ts [io-ts]
import * as t from 'io-ts';
interface CustomerIdBrand { readonly CustomerId: unique symbol }
const CustomerIdCodec = t.brand(
  t.string,
  (input): input is t.Branded<string, CustomerIdBrand> =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input),
  'CustomerId',
);
type CustomerId = t.TypeOf<typeof CustomerIdCodec>;
// string & Brand<{ readonly CustomerId: unique symbol }>
```

```ts [TypeBox + Value]
// TypeBox does not have a built-in brand utility.
// Use TypeScript's type-level branding manually:
type CustomerId = string & { readonly __brand: 'CustomerId' };
// No schema-level enforcement  - brand is a TypeScript-only type alias.
```

```ts [AJV]
// Not applicable  - AJV provides no TypeScript type branding.
```

```py [Pydantic]
from typing import Annotated, NewType

# NewType creates nominal types in Python:
CustomerId = NewType('CustomerId', str)

# Or use Annotated with a validator:
from pydantic import AfterValidator
CustomerIdType = Annotated[str, AfterValidator(lambda v: v)]
```


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
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

## Related

- [`Transform.create`](/transforms/decode-encode) - attach decode/encode with runtime conversion
- [Constraint Brands](/constraint-brands) - automatic brands from JSON Schema keywords (`format`, `pattern`, etc.)
- [Type Inference](/types/infer) - how `BrandOutputType` integrates with `InferType`

## See also

- [Bookstore domain](/bookstore-domain) - where Customer and Order IDs are defined
