# `value.cast`, `value.clean`, and `value.convert`

Schema-aware instance methods on `jt.value`. All three operate against the registry and require `enableTypeCast: true` in `JsonTology.create` options for type coercion to work.

---

## `value.cast` {#value-cast}

**Declaration.** Coerces types (e.g. `"9.99"` → `9.99`, `"true"` → `true`) and applies schema `default` values. Requires `enableTypeCast: true`. Throws `CoercionError` when the coerced data fails validation.

**Use this when** ingesting data from sources that serialize numbers and booleans as strings - CSV imports, URL query parameters, HTML form submissions, `application/x-www-form-urlencoded` bodies.

**Don't use this when** the source data is already properly typed (use [`instantiate`](/validation/instantiate) instead). Don't use `cast` when you want type coercion but not defaults (use [`convert`](#value-convert)).

### Examples

#### Example 1: Cast form input with string numbers

<<< ../../examples/docs/value/03-cast-clean-convert.ts

#### Example 2: Cast URL query params for a Review filter

<<< ../../examples/docs/value/09-cast-query-params.ts

### Comparison

::: code-group

```ts [json-tology]
const jt = JsonTology.create({ ..., enableTypeCast: true });
const book = jt.value.cast(BookSchema.$id, rawData); // strings coerced
```

```ts [Zod]
// Zod uses .instantiate() wrappers per-field:
const BookSchema = z.object({
  price:   z.coerce.number(),
  inStock: z.coerce.boolean(),
});
const book = BookSchema.parse(rawData);
```

```ts [Valibot]
import * as v from 'valibot';
// Limitation: no schema-wide cast option. Wrap each coerced field
// individually and rebuild the schema:
const BookSchema = v.object({
  price:   v.pipe(v.unknown(), v.transform(Number), v.number()),
  inStock: v.pipe(v.unknown(), v.transform(Boolean), v.boolean()),
});
const book = v.parse(BookSchema, rawData);
```

```ts [io-ts]
import * as t from 'io-ts';
// Limitation: io-ts has no schema-wide coercion. Build a custom codec for
// each field that needs to coerce string → number/boolean:
const NumberFromString = new t.Type<number, string, unknown>(
  'NumberFromString',
  (input): input is number => typeof input === 'number',
  (input, ctx) => {
    const parsed = typeof input === 'string' ? Number(input) : input;
    return typeof parsed === 'number' && !Number.isNaN(parsed)
      ? t.success(parsed) : t.failure(input, ctx);
  },
  (output) => String(output),
);
const BookCodec = t.type({ price: NumberFromString /* ... */ });
const decoded = BookCodec.decode(rawData);
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
const book = Value.Convert(BookSchema, rawData); // type conversion
```

```ts [AJV]
// AJV has { coerceTypes: true } option:
const ajv = new Ajv({ coerceTypes: true });
ajv.validate(bookSchema, rawData); // rawData mutated in place
```

```py [Pydantic]
# Pydantic v2 coerces compatible types by default (strict=False):
book = Book.model_validate(raw_data)  # '14.99' → 14.99
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

---

## `value.clean` {#value-clean}

**Declaration.** Strips properties not declared in the schema from the data. Throws `CoercionError` when the cleaned data fails validation.

**Use this when** you need to sanitize data that may carry extra properties not in the schema - for example, third-party API responses, database rows with extra columns, or enriched records that need to be reduced before forwarding.

**Don't use this when** you want defaults to be applied too (use [`instantiate`](/validation/instantiate) which does both). Use `clean` when you specifically want only stripping, no defaults.

### Examples

#### Example 1: Strip internal fields from an API response

<<< ../../examples/docs/value/10-clean-strip-internal.ts

### Comparison

::: code-group

```ts [json-tology]
const cleaned = jt.value.clean(BookSchema.$id, data);
// Unknown properties stripped; validation error thrown if invalid
```

```ts [Zod]
// Zod's default .parse() strips unknown keys:
const cleaned = BookSchema.parse(data);
```

```ts [Valibot]
import * as v from 'valibot';
// v.object() strips unknown keys by default during v.parse:
const cleaned = v.parse(BookSchema, data);
// Use v.looseObject() to preserve unknowns; v.strictObject() to reject them.
```

```ts [io-ts]
import * as t from 'io-ts';
// t.type accepts unknown extra properties; use t.exact to strip them:
const StrictBookCodec = t.exact(t.type({
  isbn:    t.string,
  title:   t.string,
  authors: t.array(t.string),
  price:   t.number,
}));
const result = StrictBookCodec.decode(data); // unknown keys removed in result.right
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
Value.Clean(BookSchema, Value.Clone(data)); // removes additional properties
```

```ts [AJV]
// AJV with { removeAdditional: true }:
const ajv = new Ajv({ removeAdditional: true });
ajv.validate(bookSchema, data); // mutates data in place
```

```py [Pydantic]
# Pydantic ignores extra fields by default (model_config extra='ignore'):
cleaned = Book.model_validate(data)
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

---

## `value.convert` {#value-convert}

**Declaration.** Coerces types without applying schema `default` values. Requires `enableTypeCast: true`. Throws `CoercionError` when the data fails validation after type conversion.

**Use this when** you want type coercion but explicitly want to control which defaults are applied. Contrast: `cast` = coerce types + fill defaults; `convert` = coerce types only; `instantiate` = coerce types + fill defaults + strip unknowns + run transforms.

### Examples

#### Example 1: Convert types for a partial review without filling defaults

<<< ../../examples/docs/value/11-convert-types-no-defaults.ts

## Related

- [`JsonTology.instantiate`](/validation/instantiate) - validate + apply defaults + strip unknowns + run transforms
- [`value.create`](/value/create) - synthesize a zero-value blank instance

## See also

- [Bookstore domain](/bookstore-domain) - where `Book`, `Review` are defined
