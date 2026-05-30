# Constraint Brands: Keywords

> Siblings: [Structural Narrowing](./narrowing) &nbsp;|&nbsp; [Validation modes reference](/validation-modes)

json-tology surfaces JSON Schema constraint keywords as compile-time phantom brands. Two values that satisfy different constraints produce incompatible TypeScript types, preventing silent misuse at compile time.

## What changes

Without brands, `{ type: 'string', format: 'email' }` and `{ type: 'string', format: 'uri' }` both infer as `string`. Any string can flow between them silently. With brands enabled (the default), each constraint keyword intersects a phantom brand onto the base type. The types become structurally incompatible.

<RunnableExample src="examples/docs/constraint-brands/02-keywords" />

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

<RunnableExample src="examples/docs/constraint-brands/03-password-constraints" />

### Number constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `format` | `FormatBrandInterface<F>` | `formatBrands` | `format: 'int32'` brands as `FormatBrandInterface<'int32'>` |
| `minimum` | `MinimumBrandInterface<N>` | `numericBrands` | `minimum: 0` brands as `MinimumBrandInterface<0>` |
| `maximum` | `MaximumBrandInterface<N>` | `numericBrands` | `maximum: 100` brands as `MaximumBrandInterface<100>` |
| `exclusiveMinimum` | `ExclusiveMinimumBrandInterface<N>` | `numericBrands` | `exclusiveMinimum: 0` brands as `ExclusiveMinimumBrandInterface<0>` |
| `exclusiveMaximum` | `ExclusiveMaximumBrandInterface<N>` | `numericBrands` | `exclusiveMaximum: 100` brands as `ExclusiveMaximumBrandInterface<100>` |
| `multipleOf` | `MultipleOfBrandInterface<N>` | `numericBrands` | `multipleOf: 5` brands as `MultipleOfBrandInterface<5>` |

<RunnableExample src="examples/docs/constraint-brands/04-numeric-brands" />

### Array constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `uniqueItems` | `UniqueItemsBrandInterface` / `UniqueArrayBrandInterface<T>` | `arrayBrands` | `uniqueItems: true` brands the array |
| `contains` | `ContainsBrandInterface<T>` | `arrayBrands` | `contains: { type: 'number' }` brands as `ContainsBrandInterface<number>` |
| `minItems` | `MinItemsBrandInterface<N>` | `arrayBrands` | `minItems: 1` brands as `MinItemsBrandInterface<1>` |
| `maxItems` | `MaxItemsBrandInterface<N>` | `arrayBrands` | `maxItems: 10` brands as `MaxItemsBrandInterface<10>` |

When `contains` is present without `items`, the array element type narrows to the contains schema type.

<RunnableExample src="examples/docs/constraint-brands/05-array-brands" />

### Object constraints <Badge type="warning" text="Compile-time + Runtime" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `minProperties` | `MinPropertiesBrandInterface<N>` | `objectBrands` | `minProperties: 1` brands as `MinPropertiesBrandInterface<1>` |
| `maxProperties` | `MaxPropertiesBrandInterface<N>` | `objectBrands` | `maxProperties: 5` brands as `MaxPropertiesBrandInterface<5>` |

When `additionalProperties: false` and properties are declared, excess property keys are flagged as `never` at compile time (requires `objectBrands` enabled):

<RunnableExample src="examples/docs/constraint-brands/06-object-properties-closed" />

### Nominal constraints <Badge type="info" text="Compile-time" />

| Keyword | Brand | Config flag | Example |
|---|---|---|---|
| `$id` | `SchemaIdBrandInterface<TId>` | `nominalBrands` | `$id: 'https://example.com/User'` makes types nominally distinct |
| `$schema` | `DialectBrandInterface<T>` | `nominalBrands` | `$schema: 'https://json-schema.org/draft/2020-12/schema'` brands the dialect |

Nominal brands make structurally identical schemas produce incompatible types when they have different `$id` values. Use `NominalSchemaType<T>` to access the branded type:

<RunnableExample src="examples/docs/constraint-brands/07-nominal-schemas" />

## Named format brands <Badge type="info" text="Compile-time" />

25 named format-brand aliases cover the full JSON Schema 2020-12 standard format set plus json-tology built-ins. Each alias specialises `FormatBrandInterface<F>` to a single format string so function signatures can name the required format explicitly.

The brand-first intersection ordering (`FormatBrandInterface<F> & string`) keeps the named brand visible in IDE hovers instead of being hidden behind `string`.

<RunnableExample src="examples/docs/constraint-brands/08-named-format-brands" />

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

<RunnableExample src="examples/docs/constraint-brands/09-allof-composition" />

### anyOf / oneOf <Badge type="warning" text="Compile-time + Runtime" />

Union preserves each branch's brands independently:

<RunnableExample src="examples/docs/constraint-brands/10-oneof-union" />

## Utility types

### `DeprecatedKeysType<T>` / `NonDeprecatedSchemaType<T>`

Filter deprecated properties from a schema type:

<RunnableExample src="examples/docs/constraint-brands/11-deprecated-keys" />

### `LooseInputType<T>`

Strips brands to the base primitive. Useful for function parameters that accept pre-validation input:

<RunnableExample src="examples/docs/constraint-brands/12-loose-input-type" />

`LooseInputType` is a standalone utility - it is not applied to library method signatures.

### `EnumValuesType<T>` / `ExhaustiveType<T>`

Extract enum values and enforce exhaustive handling:

<RunnableExample src="examples/docs/constraint-brands/27-enum-values-exhaustive" />

### `DefaultAlignedType<T>`

Validates that `default` values match the declared type. Resolves to `never` when a default mismatches:

<RunnableExample src="examples/docs/constraint-brands/28-default-aligned" />

### `IntegerRangeType<Min, Max>` / `MultipleOfRangeType<Min, Max, Step>`

Manual utilities for generating literal union types from integer ranges:

<RunnableExample src="examples/docs/constraint-brands/29-integer-range-types" />

Practical for ranges in 0-50. Larger ranges fall back to `number`.

## Configuration

All brands are enabled by default. To disable specific categories, create a `.d.ts` file anywhere in your project's `include` path (e.g. at the project root or in a `types/` directory).

### How it works

json-tology exports a `JsonTologyTypeConfigInterface` with all flags set to `true`. TypeScript's [module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation) lets you re-open that interface and override specific flags. The compiler merges your declaration with the original, and the type system reads the merged result.

This is the same pattern used by libraries like Zod, tRPC, Express, and Fastify for extensible type configuration.

### Setup

Create a file (any name, `.d.ts` extension) in your project:

<!-- inline-ts-ok: .d.ts module augmentation; must live in the consumer project's tsconfig include path and cannot run from examples/. -->
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

<RunnableExample src="examples/docs/constraint-brands/30-email-format-brand" />

| `formatBrands` | `Email` resolves to | Plain `string` assignable? |
|---|---|---|
| `true` (default) | `string & FormatBrandInterface<'email'>` | No - compile error |
| `false` | `string` | Yes |

### Before and after: numeric brands

<RunnableExample src="examples/docs/constraint-brands/24-score-numeric" />

| `numericBrands` | `Score` resolves to | Plain `number` assignable? |
|---|---|---|
| `true` (default) | `number & MinimumBrandInterface<0> & MaximumBrandInterface<100>` | No - compile error |
| `false` | `number` | Yes |

### Before and after: string brands

<RunnableExample src="examples/docs/constraint-brands/15-code-string-length" />

| `stringBrands` | `Code` resolves to | Plain `string` assignable? |
|---|---|---|
| `true` (default) | `string & MinLengthBrandInterface<3> & MaxLengthBrandInterface<10>` | No - compile error |
| `false` | `string` | Yes |

### Before and after: array brands

<RunnableExample src="examples/docs/constraint-brands/26-set-unique-items" />

| `arrayBrands` | `Set` resolves to | `readonly string[]` assignable? |
|---|---|---|
| `true` (default) | `readonly string[] & UniqueItemsBrandInterface` | No - compile error |
| `false` | `readonly string[]` | Yes |

### Before and after: object brands

<RunnableExample src="examples/docs/constraint-brands/31-closed-object" />

| `objectBrands` | Excess property `{ name: 'x', extra: 1 }` | Plain object assignable? |
|---|---|---|
| `true` (default) | compile error - `extra` is `never` | No |
| `false` | compiles (no excess check) | Yes |

### Before and after: all brands off

<!-- inline-ts-ok: .d.ts module augmentation; must live in the consumer project's tsconfig include path and cannot run from examples/. -->
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

<!-- inline-ts-ok: .d.ts module augmentation; demonstrates a deliberate typo that the consumer project's tsconfig surfaces as a compile error. -->
```ts
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface {
    formattBrands: false;  // compile error  - property does not exist
  }
}
```

## Obtaining branded values

Branded types enforce that data goes through validation. The validation API returns branded types automatically:

<RunnableExample src="examples/docs/constraint-brands/32-obtain-branded-values" />

## See also

- [`Transform.brand`](/transforms/brand) - explicit nominal branding via `BrandOutputType`
- [Type Inference](/types/infer) - how `InferType` resolves brand intersections
- [`instantiate`](/validation/instantiate) - the only source of branded values at runtime
- [Bookstore domain](/bookstore-domain) - branded primitives (`CustomerId`, `Email`, `Isbn`)
- [Picking a method](/picking-a-method) - the trust boundary that produces validated, branded values
- [Structural Narrowing](./narrowing) - patternProperties, integer ranges, if/then, dependentRequired
