# Type Inference

json-tology derives TypeScript types from `as const` JSON Schema literals at compile time. The same types flow through `coerce()`, `is()`, and the registry's type map.

## Simple

`InferType` derives a TypeScript type from an `as const` JSON Schema literal.

```ts
import type { InferType } from 'json-tology';

const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
    active: { type: 'boolean' },
  },
  required: ['name', 'age'],
} as const;

// Derive the type from the schema literal
type User = InferType<typeof UserSchema>;
// { readonly name: string; readonly age: number; readonly active?: boolean }

const user: User = { name: 'Alice', age: 30 };
```

Primitives, arrays, enums, and const values all infer correctly.

```ts
import type { InferType } from 'json-tology';

const StatusSchema = {
  $id: 'https://example.com/Status',
  type: 'string',
  enum: ['active', 'inactive', 'pending'],
} as const;

type Status = InferType<typeof StatusSchema>;
// 'active' | 'inactive' | 'pending'

const TagsSchema = {
  $id: 'https://example.com/Tags',
  type: 'array',
  items: { type: 'string' },
} as const;

type Tags = InferType<typeof TagsSchema>;
// readonly string[]
```

## Typical

`JsonTology.create()` registers schemas at construction time and builds the type map automatically. `coerce()` and `is()` return types from that map.

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology';

const AddressSchema = {
  $id: 'https://example.com/Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: { type: 'string' },
  },
  required: ['street', 'city'],
} as const;

const PersonSchema = {
  $id: 'https://example.com/Person',
  type: 'object',
  properties: {
    name: { type: 'string' },
    address: { $ref: 'https://example.com/Address' },
  },
  required: ['name'],
} as const;

// Constructor-time inference: schemas tuple builds TMap
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [AddressSchema, PersonSchema] as const,
});

// coerce() return type comes from TMap
const person = jt.coerce('https://example.com/Person', data);
// person is typed from the schema map

// is() narrows the type in conditionals
if (jt.is('https://example.com/Person', input)) {
  console.log(input.name); // string — narrowed by is()
}

// Chained register() accumulates types into the map
const EventSchema = {
  $id: 'https://example.com/Event',
  type: 'object',
  properties: {
    title: { type: 'string' },
    date: { type: 'string', format: 'date' },
  },
  required: ['title', 'date'],
} as const;

const jt2 = jt.register(EventSchema);
const event = jt2.coerce('https://example.com/Event', eventData);
// event is typed as { readonly title: string; readonly date: string }
```

Schemas with `$ref` to local `$defs` resolve at the type level.

```ts
import type { InferType } from 'json-tology';

const TreeSchema = {
  $id: 'https://example.com/Tree',
  type: 'object',
  properties: {
    value: { type: 'string' },
    children: {
      type: 'array',
      items: { $ref: '#/$defs/Node' },
    },
  },
  required: ['value'],
  $defs: {
    Node: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        children: {
          type: 'array',
          items: { $ref: '#/$defs/Node' },
        },
      },
      required: ['value'],
    },
  },
} as const;

type Tree = InferType<typeof TreeSchema>;
// { readonly value: string; readonly children?: readonly Node[] }
```

## Advanced

Reference maps resolve cross-schema `$ref` at the type level. `Transform.brand()` adds nominal types. `InferSchemaType` gives lower-level inference with explicit root and reference parameters.

### Reference maps for cross-schema `$ref`

By default, `InferType` resolves `$ref` within the same schema. For external references, pass a reference map as the second type parameter.

```ts
import type { InferType } from 'json-tology';

const CompanySchema = {
  $id: 'https://example.com/Company',
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
} as const;

const EmployeeSchema = {
  $id: 'https://example.com/Employee',
  type: 'object',
  properties: {
    name: { type: 'string' },
    company: { $ref: 'https://example.com/Company' },
  },
  required: ['name', 'company'],
} as const;

// Without a reference map, $ref to external schemas resolves to unknown.
// Pass a map of $id -> schema type to resolve cross-schema refs.
type Employee = InferType<typeof EmployeeSchema, {
  'https://example.com/Company': typeof CompanySchema;
}>;
// { readonly name: string; readonly company: { readonly name: string } }
```

### Branded types with `Transform.brand()`

Attach a nominal brand to a schema's inferred type. The schema is unchanged at runtime.

```ts
import { Transform } from 'json-tology';
import type { BrandOutputType } from 'json-tology';

const UserIdSchema = Transform.brand(
  {
    $id: 'https://example.com/UserId',
    type: 'string',
    format: 'uuid',
  } as const,
  'UserId',
);

type UserId = BrandOutputType<typeof UserIdSchema>;
// string & { readonly brand: 'UserId' }

// Prevents accidental assignment of plain strings
function getUser(id: UserId) { /* ... */ }
```

### Transforms with `coerce()` integration

Attach decode/encode functions to a schema. `coerce()` automatically applies the decoder after validation.

```ts
import { JsonTology, Transform } from 'json-tology';
const DateSchema = Transform.create(
  {
    $id: 'https://example.com/ISODate',
    type: 'string',
    format: 'date-time',
  } as const,
  {
    decode: (s: string) => new Date(s),
    encode: (d: Date) => d.toISOString(),
  },
);

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [DateSchema] as const,
});

const date = jt.coerce('https://example.com/ISODate', '2025-01-15T10:30:00Z');
// date is Date at runtime, typed as Date at compile time
console.log(date.getFullYear()); // 2025
```

### `InferSchemaType` for explicit root and reference control

`InferType<T, Refs>` is shorthand for `InferSchemaType<T, T, Refs>`. Use `InferSchemaType` directly when you need to specify a different root schema for `$ref` resolution (e.g., inferring a sub-schema within a larger root).

```ts
import type { InferSchemaType } from 'json-tology';

const CatalogSchema = {
  $id: 'https://example.com/Catalog',
  type: 'object',
  properties: {
    featured: { $ref: '#/$defs/Product' },
  },
  $defs: {
    Product: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
      },
      required: ['name', 'price'],
    },
  },
} as const;

// Infer a sub-schema type, using the parent as root for $ref resolution
type Product = InferSchemaType<
  typeof CatalogSchema['$defs']['Product'],
  typeof CatalogSchema
>;
// { readonly name: string; readonly price: number }
```

## Constraint Brands

JSON Schema constraint keywords are surfaced as compile-time phantom brands. Two values with different constraints produce incompatible TypeScript types.

```ts
import type { InferType } from 'json-tology';

const EmailSchema = { type: 'string', format: 'email' } as const;
const UriSchema   = { type: 'string', format: 'uri' } as const;

type Email = InferType<typeof EmailSchema>;
type Uri   = InferType<typeof UriSchema>;

// Email and Uri are structurally incompatible — different FormatBrand values.
// Both require runtime validation (coerce, is, materialize) to obtain.
```

Brands cover 8 categories controlled by config flags:

| Category | Keywords | Flag |
|----------|----------|------|
| Format | `format` | `formatBrands` |
| String | `minLength`, `maxLength`, `pattern` | `stringBrands` |
| Numeric | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` | `numericBrands` |
| Array | `uniqueItems`, `contains`, `minItems`, `maxItems` | `arrayBrands` |
| Content | `contentMediaType`, `contentEncoding` | `contentBrands` |
| Object | `minProperties`, `maxProperties`, `additionalProperties: false` excess flagging | `objectBrands` |
| Nominal | `$id` identity, `$schema` dialect | `nominalBrands` |
| Master | All categories | `brands` |

Beyond brands, the type system performs structural narrowing:

- **Auto integer ranges** — bounded `integer` schemas produce literal unions (e.g. `minimum: 1, maximum: 5` infers `1 | 2 | 3 | 4 | 5`)
- **`multipleOf` stepped ranges** — `multipleOf: 2, minimum: 0, maximum: 8` infers `0 | 2 | 4 | 6 | 8`
- **`not` exclusion** — `not: { type }`, `not: { const }`, `not: { enum }` narrow via `Exclude`
- **`propertyNames: { enum }` strict keys** — narrows object keys to the enum union
- **`patternProperties` template literals** — simple anchored patterns become typed keys (e.g. `^data_` becomes `` `data_${string}` ``)
- **`if/then/else` narrowing** — const-discriminated `if` clauses narrow the then branch
- **`dependentRequired` conditional typing** — trigger-key presence makes dependents required

Utility types for working with schemas:

| Type | Purpose |
|------|---------|
| `DeprecatedKeysType<T>` | Extract keys marked `deprecated: true` |
| `NonDeprecatedSchemaType<T>` | Omit deprecated properties from inferred type |
| `LooseInputType<T>` | Strip brands to base primitive (for pre-validation input) |
| `EnumValuesType<T>` | Extract enum values as a union type |
| `ExhaustiveType<T>` | Enforce exhaustive switch/case handling |
| `DefaultAlignedType<T>` | Resolves to `never` when defaults mismatch declared types |
| `IntegerRangeType<Min, Max>` | Manual literal union for integer ranges |
| `MultipleOfRangeType<Min, Max, Step>` | Stepped literal union for multiples |

See [constraint-brands.md](./constraint-brands.md) for the full reference, configuration, and examples.
