# `Transform.brand`

**Declaration.** Attaches a compile-time nominal brand string to a schema's TypeScript type. Returns the same schema object at runtime - no WeakMap entry is created, no runtime effect. The TypeScript return type becomes `BrandedType<TSchema, TBrand>`, which intersects the inferred type with `{ readonly brand: TBrand }`. Access the branded type via `BrandOutputType<typeof schema>`.

**Use this when** you need nominally distinct types for identifiers that are structurally identical at runtime - `CustomerId` and `OrderId` are both UUID strings, but TypeScript should refuse to let you pass one where the other is expected. This prevents mixing up ID fields from different entity types.

**Don't use this when** you need an automatic decode/encode transformation (use [`Transform.create`](/transforms/decode-encode)). Don't use it for automatic runtime validation beyond what JSON Schema already provides - `brand` is purely a compile-time marker.

## Examples

### Example 1: Nominally distinct Customer and Order IDs

```ts
import { Transform, JsonTology } from 'json-tology';
import type { BrandOutputType } from 'json-tology/types';

const CustomerIdSchema = Transform.brand(
  { $id: 'https://bookstore.example/CustomerId', type: 'string', format: 'uuid' } as const,
  'CustomerId',
);

const OrderIdSchema = Transform.brand(
  { $id: 'https://bookstore.example/OrderId', type: 'string', format: 'uuid' } as const,
  'OrderId',
);

type CustomerId = BrandOutputType<typeof CustomerIdSchema>;
type OrderId    = BrandOutputType<typeof OrderIdSchema>;

// Both are string at runtime, but compile-time incompatible:
// const cid: CustomerId = 'abc' as OrderId;  // compile error

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CustomerIdSchema, OrderIdSchema] as const,
});

// The only way to obtain a branded value  - go through coerce:
const cid = jt.instantiate(CustomerIdSchema.$id, 'c1a2b3d4-e5f6-7890-abcd-ef1234567890');
// cid is typed as CustomerId

function lookupCustomer(id: CustomerId) { /* ... */ }
lookupCustomer(cid); // OK  - typed correctly
```

### Example 2: Branded ISBN for books

```ts
const IsbnSchema = Transform.brand(
  {
    $id:     'https://bookstore.example/ISBN13',
    type:    'string',
    pattern: '^\\d{13}$',
  } as const,
  'ISBN13',
);

type ISBN13 = BrandOutputType<typeof IsbnSchema>;

// lookupBook(isbn: ISBN13) prevents passing plain unvalidated strings
```

## Bad examples - what NOT to do

### Anti-pattern 1: Applying brand after the schema has been registered

```ts
// ⊥ Don't do this  - brand only changes the TypeScript type, not the registration
const RawSchema = { $id: '...', type: 'string' } as const;
jt.register(RawSchema);
// The brand is applied to a different object reference  - the registered schema is unchanged
const Branded = Transform.brand(RawSchema, 'MyBrand');

// ✓ Do this  - brand before registration
const Branded2 = Transform.brand({ $id: '...', type: 'string' } as const, 'MyBrand');
jt.register(Branded2);
```

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

:::

## Related

- [`Transform.create`](/transforms/decode-encode) - attach decode/encode with runtime conversion
- [Constraint Brands](/constraint-brands) - automatic brands from JSON Schema keywords (`format`, `pattern`, etc.)
- [Type Inference](/types) - how `BrandOutputType` integrates with `InferType`

## See also

- [Bookstore domain](/bookstore-domain) - where Customer and Order IDs are defined
