# `value.cast`, `value.clean`, and `value.convert`

Schema-aware instance methods on `jt.value`. All three operate against the registry and require `enableTypeCast: true` in `JsonTology.create` options for type coercion to work.

---

## `value.cast` {#value-cast}

**Declaration.** Coerces types (e.g. `"9.99"` → `9.99`, `"true"` → `true`) and applies schema `default` values. Requires `enableTypeCast: true`. Throws `CoercionError` when the coerced data fails validation.

**Use this when** ingesting data from sources that serialize numbers and booleans as strings - CSV imports, URL query parameters, HTML form submissions, `application/x-www-form-urlencoded` bodies.

**Don't use this when** the source data is already properly typed (use [`instantiate`](/validation/instantiate) instead). Don't use `cast` when you want type coercion but not defaults (use [`convert`](#value-convert)).

### Examples

#### Example 1: Cast form input with string numbers

<RunnableExample src="examples/docs/value/03-cast-clean-convert" />

#### Example 2: Cast URL query params for a Review filter

<RunnableExample src="examples/docs/value/09-cast-query-params" />

---

## `value.clean` {#value-clean}

**Declaration.** Strips properties not declared in the schema from the data. Throws `CoercionError` when the cleaned data fails validation.

**Use this when** you need to sanitize data that may carry extra properties not in the schema - for example, third-party API responses, database rows with extra columns, or enriched records that need to be reduced before forwarding.

**Don't use this when** you want defaults to be applied too (use [`instantiate`](/validation/instantiate) which does both). Use `clean` when you specifically want only stripping, no defaults.

### Examples

#### Example 1: Strip internal fields from an API response

<RunnableExample src="examples/docs/value/10-clean-strip-internal" />

---

## `value.convert` {#value-convert}

**Declaration.** Coerces types without applying schema `default` values. Requires `enableTypeCast: true`. Throws `CoercionError` when the data fails validation after type conversion.

**Use this when** you want type coercion but explicitly want to control which defaults are applied. Contrast: `cast` = coerce types + fill defaults; `convert` = coerce types only; `instantiate` = coerce types + fill defaults + strip unknowns + run transforms.

### Examples

#### Example 1: Convert types for a partial review without filling defaults

<RunnableExample src="examples/docs/value/11-convert-types-no-defaults" />

---

## Comparison

`cast` fills defaults, `clean` strips unknown properties, `convert` coerces types only. Other libraries rarely separate these three concerns; each tab notes how the library maps onto them.

::: code-group

```ts [json-tology]
const jt = JsonTology.create({ ..., enableTypeCast: true });

const book    = jt.value.cast(BookSchema.$id, rawData);   // cast: coerce + fill defaults
const cleaned = jt.value.clean(BookSchema.$id, data);     // clean: strip unknown properties
const partial = jt.value.convert(BookSchema.$id, rawData); // convert: coerce only, no defaults
```

```ts [Zod]
// cast — .coerce wrappers per-field, defaults filled by Zod's own .default():
const BookSchema = z.object({
  price:   z.coerce.number(),
  inStock: z.coerce.boolean(),
});
const book = BookSchema.parse(rawData);

// clean — .parse() strips unknown keys by default (same mechanism as cast above):
const cleaned = BookSchema.parse(data);

// convert — Limitation: no built-in way to coerce without also applying
// .default() on the same schema; requires a second schema without defaults.
```

```ts [Valibot]
import * as v from 'valibot';

// cast — Limitation: no schema-wide cast option. Wrap each coerced field
// individually and rebuild the schema:
const BookSchema = v.object({
  price:   v.pipe(v.unknown(), v.transform(Number), v.number()),
  inStock: v.pipe(v.unknown(), v.transform(Boolean), v.boolean()),
});
const book = v.parse(BookSchema, rawData);

// clean — v.object() strips unknown keys by default during v.parse:
const cleaned = v.parse(BookSchema, data);
// Use v.looseObject() to preserve unknowns; v.strictObject() to reject them.

// convert — same Limitation as cast: no schema-wide option to coerce
// without a separate defaults step.
```

```ts [io-ts]
import * as t from 'io-ts';

// cast — Limitation: io-ts has no schema-wide coercion. Build a custom codec
// for each field that needs to coerce string → number/boolean:
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

// clean — t.type accepts unknown extra properties; use t.exact to strip them:
const StrictBookCodec = t.exact(t.type({
  isbn:    t.string,
  title:   t.string,
  authors: t.array(t.string),
  price:   t.number,
}));
const result = StrictBookCodec.decode(data); // unknown keys removed in result.right

// convert — same custom-codec approach as cast, minus any default-filling logic.
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';

const book    = Value.Convert(BookSchema, rawData);       // cast: type conversion
Value.Clean(BookSchema, Value.Clone(data));                // clean: removes additional properties
const partial = Value.Convert(PartialSchema, rawData);      // convert: same call against a schema with no defaults
```

```ts [AJV]
// cast — { coerceTypes: true } combined with AJV's useDefaults:
const ajv = new Ajv({ coerceTypes: true, useDefaults: true });
ajv.validate(bookSchema, rawData); // rawData mutated in place

// clean — { removeAdditional: true }:
const ajvClean = new Ajv({ removeAdditional: true });
ajvClean.validate(bookSchema, data); // mutates data in place

// convert — { coerceTypes: true } alone, useDefaults omitted:
const ajvConvert = new Ajv({ coerceTypes: true });
ajvConvert.validate(bookSchema, rawData);
```

```py [Pydantic]
# cast — Pydantic v2 coerces compatible types and fills defaults together
# (strict=False is the default); the two are not separable:
book = Book.model_validate(raw_data)  # '14.99' → 14.99

# clean — extra fields are ignored by default (model_config extra='ignore'):
cleaned = Book.model_validate(data)

# convert — Limitation: no way to coerce types without also filling
# defaults on the same model.
```

```ts [Yup / Joi / Effect Schema / ArkType / Runtypes]
// Limitation: cast, clean, and convert are not directly supported as
// separate operations in these libraries. See /comparisons for the matrix.
```

:::

## Related

- [`JsonTology.instantiate`](/validation/instantiate) - validate + apply defaults + strip unknowns + run transforms
- [`value.create`](/value/create) - synthesize a zero-value blank instance

## See also

- [Bookstore domain](/bookstore-domain) - where `Book`, `Review` are defined
