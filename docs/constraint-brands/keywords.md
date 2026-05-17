# Constraint Brands: Keywords

> Siblings: [Structural Narrowing](./narrowing) &nbsp;|&nbsp; [Validation modes reference](/validation-modes)

json-tology surfaces JSON Schema constraint keywords as compile-time phantom brands. Two values that satisfy different constraints produce incompatible TypeScript types, preventing silent misuse at compile time.

## What changes

Without brands, `{ type: 'string', format: 'email' }` and `{ type: 'string', format: 'uri' }` both infer as `string`. Any string can flow between them silently. With brands enabled (the default), each constraint keyword intersects a phantom brand onto the base type. The types become structurally incompatible.

<<< ../../examples/docs/constraint-brands/02-keywords.ts

| | Brands ON (default) | Brands OFF |
|---|---|---|
| `Email` resolves to | `string & FormatBrandInterface<'email'>` | `string` |
| `Uri` resolves to | `string & FormatBrandInterface<'uri'>` | `string` |
| `const x: Email = '' as string` | compile error | compiles |
| `const x: Email = '' as Uri` | compile error | compiles |
| `const x: Email = jt.instantiate(id, data)` | compiles | compiles |

The only way to obtain a branded value is through the validation API (`instantiate`, `materialize`, `is`, `value.cast`, etc.). This is intentional - it enforces that data passes runtime validation before being treated as a constrained type.

## Branded keywords

### String constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `format` | `FormatBrandInterface<F>` | `formatBrands` | `format: 'email'` brands as `FormatBrandInterface<'email'>` |
| `pattern` | `PatternBrandInterface<P>` | `stringBrands` | `pattern: '^[A-Z]'` brands as `PatternBrandInterface<'^[A-Z]'>` |
| `minLength` | `MinLengthBrandInterface<N>` | `stringBrands` | `minLength: 5` brands as `MinLengthBrandInterface<5>` |
| `maxLength` | `MaxLengthBrandInterface<N>` | `stringBrands` | `maxLength: 100` brands as `MaxLengthBrandInterface<100>` |
| `contentMediaType` | `ContentMediaTypeBrandInterface<T>` | `contentBrands` | `contentMediaType: 'image/png'` brands as `ContentMediaTypeBrandInterface<'image/png'>` |
| `contentEncoding` | `ContentEncodingBrandInterface<T>` | `contentBrands` | `contentEncoding: 'base64'` brands as `ContentEncodingBrandInterface<'base64'>` |

```ts
const PasswordSchema = {
  type: 'string',
  minLength: 8,
  maxLength: 128,
  pattern: '^(?=.*[A-Z])(?=.*[0-9])',
} as const;

type Password = InferType<typeof PasswordSchema>;
// string & MinLengthBrandInterface<8> & MaxLengthBrandInterface<128> & PatternBrandInterface<'^(?=.*[A-Z])(?=.*[0-9])'>

const raw: string = 'hello';
const pw: Password = raw;  // compile error  - must go through validation
```

### Number constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `format` | `FormatBrandInterface<F>` | `formatBrands` | `format: 'int32'` brands as `FormatBrandInterface<'int32'>` |
| `minimum` | `MinimumBrandInterface<N>` | `numericBrands` | `minimum: 0` brands as `MinimumBrandInterface<0>` |
| `maximum` | `MaximumBrandInterface<N>` | `numericBrands` | `maximum: 100` brands as `MaximumBrandInterface<100>` |
| `exclusiveMinimum` | `ExclusiveMinimumBrandInterface<N>` | `numericBrands` | `exclusiveMinimum: 0` brands as `ExclusiveMinimumBrandInterface<0>` |
| `exclusiveMaximum` | `ExclusiveMaximumBrandInterface<N>` | `numericBrands` | `exclusiveMaximum: 100` brands as `ExclusiveMaximumBrandInterface<100>` |
| `multipleOf` | `MultipleOfBrandInterface<N>` | `numericBrands` | `multipleOf: 5` brands as `MultipleOfBrandInterface<5>` |

```ts
const PercentSchema = {
  type: 'number',
  minimum: 0,
  maximum: 100,
} as const;

const TemperatureSchema = {
  type: 'number',
  minimum: -273,
} as const;

type Percent     = InferType<typeof PercentSchema>;
type Temperature = InferType<typeof TemperatureSchema>;

// Percent:     number & MinimumBrandInterface<0> & MaximumBrandInterface<100>
// Temperature: number & MinimumBrandInterface<-273>

// These are incompatible  - different MinimumBrand values
const temp: Temperature = {} as Percent;  // compile error
```

### Array constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `uniqueItems` | `UniqueItemsBrandInterface` / `UniqueArrayBrandInterface<T>` | `arrayBrands` | `uniqueItems: true` brands the array |
| `contains` | `ContainsBrandInterface<T>` | `arrayBrands` | `contains: { type: 'number' }` brands as `ContainsBrandInterface<number>` |
| `minItems` | `MinItemsBrandInterface<N>` | `arrayBrands` | `minItems: 1` brands as `MinItemsBrandInterface<1>` |
| `maxItems` | `MaxItemsBrandInterface<N>` | `arrayBrands` | `maxItems: 10` brands as `MaxItemsBrandInterface<10>` |

When `contains` is present without `items`, the array element type narrows to the contains schema type.

```ts
const TagSetSchema = {
  type: 'array',
  items: { type: 'string' },
  uniqueItems: true,
} as const;

type TagSet = InferType<typeof TagSetSchema>;
// readonly string[] & UniqueItemsBrandInterface

const NumberArraySchema = {
  type: 'array',
  contains: { type: 'number' },
} as const;

type NumberArray = InferType<typeof NumberArraySchema>;
// readonly number[] & ContainsBrandInterface<number>
```

### Object constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `minProperties` | `MinPropertiesBrandInterface<N>` | `objectBrands` | `minProperties: 1` brands as `MinPropertiesBrandInterface<1>` |
| `maxProperties` | `MaxPropertiesBrandInterface<N>` | `objectBrands` | `maxProperties: 5` brands as `MaxPropertiesBrandInterface<5>` |

When `additionalProperties: false` and properties are declared, excess property keys are flagged as `never` at compile time (requires `objectBrands` enabled):

```ts
const ClosedSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
  },
  additionalProperties: false,
} as const;

type Closed = InferType<typeof ClosedSchema>;

const ok: Closed = { name: 'Bastian Balthazar Bux', age: 30 };      // compiles
const bad: Closed = { name: 'Bob', extra: true };    // compile error  - 'extra' is never
```

### Nominal constraints <Badge type="info" text="Compile-time" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `$id` | `SchemaIdBrandInterface<TId>` | `nominalBrands` | `$id: 'https://example.com/User'` makes types nominally distinct |
| `$schema` | `DialectBrandInterface<T>` | `nominalBrands` | `$schema: 'https://json-schema.org/draft/2020-12/schema'` brands the dialect |

Nominal brands make structurally identical schemas produce incompatible types when they have different `$id` values. Use `NominalSchemaType<T>` to access the branded type:

```ts
import type { NominalSchemaType } from 'json-tology/types';

const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: { name: { type: 'string' } },
} as const;

const EmployeeSchema = {
  $id: 'https://example.com/Employee',
  type: 'object',
  properties: { name: { type: 'string' } },
} as const;

type User = NominalSchemaType<typeof UserSchema>;
type Employee = NominalSchemaType<typeof EmployeeSchema>;

// Structurally identical but nominally distinct  - cannot assign one to the other
```

## Named format brands <Badge type="info" text="Compile-time" />

25 named format-brand aliases cover the full JSON Schema 2020-12 standard format set plus json-tology built-ins. Each alias specialises `FormatBrandInterface<F>` to a single format string so function signatures can name the required format explicitly.

The brand-first intersection ordering (`FormatBrandInterface<F> & string`) keeps the named brand visible in IDE hovers instead of being hidden behind `string`.

```ts
import type { EmailBrandInterface, UuidBrandInterface } from 'json-tology/types';

// Reject plain string — must come from instantiate/validate
function send(to: EmailBrandInterface): void { ... }
function track(id: UuidBrandInterface): void { ... }
```

### Standard format aliases

| Brand type | Format string |
|-----------|--------------|
| `EmailBrandInterface` | `'email'` |
| `IdnEmailBrandInterface` | `'idn-email'` |
| `UriBrandInterface` | `'uri'` |
| `UriReferenceBrandInterface` | `'uri-reference'` |
| `UriTemplateBrandInterface` | `'uri-template'` |
| `IriBrandInterface` | `'iri'` |
| `IriReferenceBrandInterface` | `'iri-reference'` |
| `UuidBrandInterface` | `'uuid'` |
| `DateBrandInterface` | `'date'` |
| `DateTimeBrandInterface` | `'date-time'` |
| `TimeBrandInterface` | `'time'` |
| `DurationBrandInterface` | `'duration'` |
| `HostnameBrandInterface` | `'hostname'` |
| `IdnHostnameBrandInterface` | `'idn-hostname'` |
| `Ipv4BrandInterface` | `'ipv4'` |
| `Ipv6BrandInterface` | `'ipv6'` |
| `RegexBrandInterface` | `'regex'` |
| `JsonPointerBrandInterface` | `'json-pointer'` |
| `RelativeJsonPointerBrandInterface` | `'relative-json-pointer'` |
| `BinaryBrandInterface` | `'binary'` |
| `ByteBrandInterface` | `'byte'` |
| `Int32BrandInterface` | `'int32'` |
| `Int64BrandInterface` | `'int64'` |
| `FloatBrandInterface` | `'float'` |
| `DoubleBrandInterface` | `'double'` |

Use the generic `FormatBrandInterface<F>` for custom format strings not covered by the named aliases.

## Composition

Brands compose naturally through JSON Schema composition keywords.

### allOf <Badge type="warning" text="Compile-time + Runtime" />

Intersection merges brands from all branches:

```ts
const ValidatedEmail = {
  allOf: [
    { type: 'string', format: 'email' },
    { type: 'string', minLength: 5 },
  ],
} as const;

type VEmail = InferType<typeof ValidatedEmail>;
// string & FormatBrandInterface<'email'> & string & MinLengthBrandInterface<5>
// simplifies to: string & FormatBrandInterface<'email'> & MinLengthBrandInterface<5>
```

### anyOf / oneOf <Badge type="warning" text="Compile-time + Runtime" />

Union preserves each branch's brands independently:

```ts
const IdSchema = {
  oneOf: [
    { type: 'string', format: 'uuid' },
    { type: 'number', minimum: 1 },
  ],
} as const;

type Id = InferType<typeof IdSchema>;
// (string & FormatBrandInterface<'uuid'>) | (number & MinimumBrandInterface<1>)
```

## Utility types

### `DeprecatedKeysType<T>` / `NonDeprecatedSchemaType<T>`

Filter deprecated properties from a schema type:

```ts
import type { DeprecatedKeysType, NonDeprecatedSchemaType } from 'json-tology/types';

const UserSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    legacyId: { type: 'string', deprecated: true },
  },
  required: ['name'],
} as const;

type DepKeys = DeprecatedKeysType<typeof UserSchema>;  // 'legacyId'
type User = NonDeprecatedSchemaType<typeof UserSchema>; // { name: string }  - no legacyId
```

### `LooseInputType<T>`

Strips brands to the base primitive. Useful for function parameters that accept pre-validation input:

```ts
import type { InferType, LooseInputType } from 'json-tology/types';

const EmailSchema = { type: 'string', format: 'email' } as const;
type Email = InferType<typeof EmailSchema>;  // string & FormatBrandInterface<'email'>
type Input = LooseInputType<Email>;          // string
```

`LooseInputType` is a standalone utility - it is not applied to library method signatures.

### `EnumValuesType<T>` / `ExhaustiveType<T>`

Extract enum values and enforce exhaustive handling:

```ts
import type { EnumValuesType, ExhaustiveType } from 'json-tology/types';

const StatusSchema = { enum: ['active', 'inactive', 'pending'] } as const;

type Status = EnumValuesType<typeof StatusSchema>;
// 'active' | 'inactive' | 'pending'

function handle(s: Status): string {
  switch (s) {
    case 'active': return 'on';
    case 'inactive': return 'off';
    case 'pending': return 'waiting';
    default: return s satisfies ExhaustiveType<typeof s>;
  }
}
```

### `DefaultAlignedType<T>`

Validates that `default` values match the declared type. Resolves to `never` when a default mismatches:

```ts
import type { DefaultAlignedType } from 'json-tology/types';

const GoodSchema = {
  type: 'object',
  properties: {
    count: { type: 'number', default: 0 },
  },
} as const;

const BadSchema = {
  type: 'object',
  properties: {
    count: { type: 'number', default: 'zero' },  // string default on number property
  },
} as const;

type Good = DefaultAlignedType<typeof GoodSchema>;  // typeof GoodSchema
type Bad = DefaultAlignedType<typeof BadSchema>;     // never
```

### `IntegerRangeType<Min, Max>` / `MultipleOfRangeType<Min, Max, Step>`

Manual utilities for generating literal union types from integer ranges:

```ts
import type { IntegerRangeType, MultipleOfRangeType } from 'json-tology/types';

type Rating = IntegerRangeType<1, 5>;           // 1 | 2 | 3 | 4 | 5
type EvenDigit = MultipleOfRangeType<0, 8, 2>;  // 0 | 2 | 4 | 6 | 8
```

Practical for ranges in 0-50. Larger ranges fall back to `number`.

## Configuration

All brands are enabled by default. To disable specific categories, create a `.d.ts` file anywhere in your project's `include` path (e.g. at the project root or in a `types/` directory).

### How it works

json-tology exports a `JsonTologyTypeConfigInterface` with all flags set to `true`. TypeScript's [module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation) lets you re-open that interface and override specific flags. The compiler merges your declaration with the original, and the type system reads the merged result.

This is the same pattern used by libraries like Zod, tRPC, Express, and Fastify for extensible type configuration.

### Setup

Create a file (any name, `.d.ts` extension) in your project:

```ts
// json-tology.d.ts
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface {
    formatBrands: false;   // disable format brands
    numericBrands: false;  // disable numeric brands
  }
}
```

No import needed. No build step. The file just needs to be in your tsconfig's `include` path.

### Available flags

| Flag | Default | Controls |
|---|---|---|
| `brands` | `true` | Master switch. When `false`, disables all brands. |
| `formatBrands` | `true` | `format` on strings and numbers. |
| `stringBrands` | `true` | `minLength`, `maxLength`, `pattern` on strings. |
| `numericBrands` | `true` | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` on numbers. |
| `arrayBrands` | `true` | `uniqueItems`, `contains`, `minItems`, `maxItems` on arrays. |
| `contentBrands` | `true` | `contentMediaType`, `contentEncoding` on strings. |
| `objectBrands` | `true` | `minProperties`, `maxProperties` on objects. `additionalProperties: false` excess flagging. |
| `nominalBrands` | `true` | `$id` nominal identity, `$schema` dialect branding. |

The master `brands` flag takes precedence. When `brands: false`, all other flags are ignored and no brands are applied.

### Before and after: format brands

```ts
const EmailSchema = { type: 'string', format: 'email' } as const;
type Email = InferType<typeof EmailSchema>;
```

| `formatBrands` | `Email` resolves to | Plain `string` assignable? |
|---|---|---|
| `true` (default) | `string & FormatBrandInterface<'email'>` | No - compile error |
| `false` | `string` | Yes |

### Before and after: numeric brands

```ts
const ScoreSchema = { type: 'number', minimum: 0, maximum: 100 } as const;
type Score = InferType<typeof ScoreSchema>;
```

| `numericBrands` | `Score` resolves to | Plain `number` assignable? |
|---|---|---|
| `true` (default) | `number & MinimumBrandInterface<0> & MaximumBrandInterface<100>` | No - compile error |
| `false` | `number` | Yes |

### Before and after: string brands

```ts
const CodeSchema = { type: 'string', minLength: 3, maxLength: 10 } as const;
type Code = InferType<typeof CodeSchema>;
```

| `stringBrands` | `Code` resolves to | Plain `string` assignable? |
|---|---|---|
| `true` (default) | `string & MinLengthBrandInterface<3> & MaxLengthBrandInterface<10>` | No - compile error |
| `false` | `string` | Yes |

### Before and after: array brands

```ts
const SetSchema = { type: 'array', items: { type: 'string' }, uniqueItems: true } as const;
type Set = InferType<typeof SetSchema>;
```

| `arrayBrands` | `Set` resolves to | `readonly string[]` assignable? |
|---|---|---|
| `true` (default) | `readonly string[] & UniqueItemsBrandInterface` | No - compile error |
| `false` | `readonly string[]` | Yes |

### Before and after: object brands

```ts
const ClosedSchema = {
  type: 'object',
  properties: { name: { type: 'string' } },
  additionalProperties: false,
} as const;
type Closed = InferType<typeof ClosedSchema>;
```

| `objectBrands` | Excess property `{ name: 'x', extra: 1 }` | Plain object assignable? |
|---|---|---|
| `true` (default) | compile error - `extra` is `never` | No |
| `false` | compiles (no excess check) | Yes |

### Before and after: all brands off

```ts
// json-tology.d.ts  - disable everything
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface {
    brands: false;
  }
}
```

All `InferType` results revert to plain TypeScript types with no phantom brands. The library behaves identically to before brands were introduced. Runtime validation is unaffected.

### Checking your config

The augmented interface is type-checked. A typo in a flag name produces a compile error:

```ts
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface {
    formattBrands: false;  // compile error  - property does not exist
  }
}
```

## Obtaining branded values

Branded types enforce that data goes through validation. The validation API returns branded types automatically:

```ts
import { JsonTology } from 'json-tology';

const EmailSchema = {
  $id: 'https://example.com/Email',
  type: 'string',
  format: 'email',
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [EmailSchema] as const,
});

// All of these return branded types:
const email = jt.instantiate('https://example.com/Email', input);     // string & FormatBrandInterface<'email'>
const clean = jt.value.instantiate('https://example.com/Email', input); // same

if (jt.is('https://example.com/Email', input)) {
  input; // narrowed to branded type
}
```

## See also

- [`Transform.brand`](/transforms/brand) - explicit nominal branding via `BrandOutputType`
- [Type Inference](/types/infer) - how `InferType` resolves brand intersections
- [`instantiate`](/validation/instantiate) - the only source of branded values at runtime
- [Bookstore domain](/bookstore-domain) - branded primitives (`CustomerId`, `Email`, `Isbn`)
- [Picking a method](/picking-a-method) - the trust boundary that produces validated, branded values
- [Structural Narrowing](./narrowing) - patternProperties, integer ranges, if/then, dependentRequired
