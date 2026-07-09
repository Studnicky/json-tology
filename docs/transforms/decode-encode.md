# `Transform.create` and `jt.encode` <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

`Transform.create` and `jt.encode` are a symmetric pair: `create` attaches decode/encode functions to a schema, and `jt.encode` uses the registered encode function to convert a domain value back to wire form.

---

## `Transform.create` {#transform-create}

**Declaration.** Attaches `decode` and `encode` functions to a schema using a `WeakMap` (the schema object is never mutated). Returns the same schema object with a widened TypeScript type `TransformedType<TSchema, TOut>`. After `Transform.create`, any call to `jt.instantiate(schema.$id, raw)` automatically applies the `decode` function **before** validation — the schema describes `decode`'s output, so validation (which fills defaults and strips unknown properties) runs on the decoded result. See [Canonical decode/default ordering](/instantiate-vs-materialize#canonical-decode-default-ordering) for the full sequence. The TypeScript return type changes from `InferSchemaType<TSchema>` to `TOut`.

**Use this when** a wire-format value needs automatic conversion to a richer domain type - ISO date strings → `Date`, cents integers → floats, raw enums → branded enums, base64 strings → `Buffer`.

**Don't use this when** you want multiple sequential transformations (use [`chain`](/transforms/chain) instead). Don't use it for nominal typing without runtime conversion (use [`brand`](/transforms/brand)).

### Examples

#### Example 1: ISO datetime to Date - full round-trip

<RunnableExample src="examples/docs/transforms/01-decode-encode" />

#### Example 2: Price in cents to decimal

<RunnableExample src="examples/docs/transforms/04-price-cents-transform" />

#### Example 3: `jt.addTransform` — registry-aware transform registration

`jt.addTransform(schema, { decode, encode })` is the instance-bound counterpart to `Transform.create`. The key difference: `decode` input types resolve cross-registry `$ref`s through the instance's schema map, so a schema whose properties `$ref` registered primitives gets a fully-typed decode input — no cast, no `unknown`.

<RunnableExample src="examples/docs/advanced/111-add-transform" />

### Bad examples - what NOT to do

#### Anti-pattern 1: Applying transform after the schema was registered

<RunnableExample src="examples/docs/transforms/05-encode-roundtrip" />

### Comparison

::: code-group

```ts [json-tology]
const DateSchema = Transform.create(
  { $id: 'https://bookstore.example/PlacedAt', type: 'string', format: 'date-time' } as const,
  {
    decode: (isoStr: string) => new Date(isoStr),
    encode: (dateVal: Date) => dateVal.toISOString()
  },
);
// jt.instantiate(DateSchema.$id, '2026-01-15T10:30:00Z') → Date
// jt.encode(DateSchema, date) → '2026-01-15T10:30:00Z'
// Note: json-tology enforces strict RFC 3339 for date-time — a time offset
// (Z or ±HH:MM) is required. Offset-less strings (e.g. '2026-01-15T10:30:00')
// are rejected at validation time.
```

```ts [Zod]
const DateSchema = z.string().datetime().transform(s => new Date(s));
DateSchema.parse('2026-01-15T10:30:00Z'); // → Date
// No built-in encode step  - call .toISOString() manually for the reverse.
```

```ts [Valibot]
import * as v from 'valibot';
const DateSchema = v.pipe(
  v.string(),
  v.isoDateTime(),
  v.transform((s) => new Date(s)),
);
v.parse(DateSchema, '2026-01-15T10:30:00Z'); // → Date
// Limitation: Valibot has no first-class encode direction. Define a
// separate inverse schema or call dateVal.toISOString() manually.
```

```ts [io-ts]
import * as t from 'io-ts';
import { isLeft } from 'fp-ts/Either';
const DateCodec = new t.Type<Date, string, unknown>(
  'DateFromIsoString',
  (input): input is Date => input instanceof Date,
  (input, ctx) => typeof input === 'string' && !Number.isNaN(Date.parse(input))
    ? t.success(new Date(input))
    : t.failure(input, ctx),
  (date) => date.toISOString(),
);
const decoded = DateCodec.decode('2026-01-15T10:30:00Z'); // Either<Errors, Date>
if (!isLeft(decoded)) { /* decoded.right is Date */ }
const wire = DateCodec.encode(new Date()); // Date → ISO string
// io-ts codecs carry symmetric .decode and .encode; compose with t.union /
// t.intersection to build larger transforms.
```

```ts [TypeBox + Value]
// TypeBox validates only  - no decode/encode transform mechanism.
// Apply manually after validation:
const C = TypeCompiler.Compile(Type.String({ format: 'date-time' }));
if (C.Check(raw)) {
  const date = new Date(raw); // manual decode
}
```

```ts [AJV]
// AJV validates only  - no decode/encode.
if (ajv.validate({ type: 'string', format: 'date-time' }, raw)) {
  const date = new Date(raw); // manual
}
```

```py [Pydantic]
from datetime import datetime

class Order(BaseModel):
    placed_at: datetime  # Pydantic auto-converts ISO strings to datetime
    # model_dump(mode='json') serializes datetime back to ISO string
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

### Related

- [`jt.encode`](#jtencode) - apply the encode function (domain → wire)
- [`chain`](/transforms/chain) - compose multiple transformation steps
- [`brand`](/transforms/brand) - compile-time nominal typing without runtime decode
- [`dump`](/serialization/dump) - applies `encode` during schema graph traversal

---

## `jt.encode` {#jtencode}

**Declaration.** Applies the `encode` function registered on `schema` via `Transform.create` or `Transform.chain`. Converts a decoded domain value back to its wire representation. Returns the brand-free wire **InputType** (`LooseInputType<InferSchemaType<TSchema>>`) — encode runs on the way out to the wire, where validation brands do not exist. If no transform is registered on the schema, returns the value unchanged.

**Use this when** you have a decoded domain value (e.g. a `Date` object) and need the wire form (e.g. ISO string) for storage, HTTP response, or queue message.

**Don't use this when** you want to serialize a whole object graph - use [`dump`](/serialization/dump) which walks the schema graph and applies encode to each transformed property.

### Examples

#### Example 1: Round-trip a placement timestamp

<RunnableExample src="examples/docs/transforms/05-encode-roundtrip" />

#### Example 2: Serialize before database write

<RunnableExample src="examples/docs/transforms/06-encode-before-db-write" />

### Comparison

::: code-group

```ts [json-tology]
const wire = jt.encode(PlacedAtSchema, date); // Date → string
```

```ts [Zod]
// Zod has no built-in encode step; call manually:
const wire = date.toISOString();
// Limitation: encode is decoupled from schema - the reverse transformation
// is not registered anywhere; callers must remember which function to call per type.
```

```ts [Valibot]
import * as v from 'valibot';
// Limitation: Valibot has no schema-registered encode step.
// Apply the inverse transformation manually:
const wire = (date as Date).toISOString();
```

```ts [io-ts]
const wire = DateCodec.encode(date); // domain → wire, schema-registered
// Symmetric with .decode; no separate facade needed.
```

```ts [TypeBox + Value]
// TypeBox has no built-in encode mechanism.
// Apply the encode transformation manually:
const wire = (date as Date).toISOString();
// Limitation: encode step is not schema-associated; every call site must know
// which encode function applies. No round-trip guarantee without discipline.
```

```ts [AJV]
// AJV has no built-in encode mechanism. Apply manually:
const wire = (date as Date).toISOString();
// Limitation: same as TypeBox - encode is not schema-registered;
// no symmetric round-trip guarantee.
```

```py [Pydantic]
# model_dump(mode='json') serializes datetime to ISO string:
wire = order.model_dump(mode='json')['placed_at']  # str
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

### Related

- [`Transform.create`](#transform-create) - where the encode function is registered
- [`dump`](/serialization/dump) - applies `encode` while walking the full schema graph

## Error handling

When a decode transform throws, `jt.instantiate` wraps the failure in a `DecodeError` (code `TRANSFORM_DECODE_FAILED`, direction `'decode'`). When an encode transform throws, `jt.encode` wraps it in an `EncodeError` (code `TRANSFORM_ENCODE_FAILED`, direction `'encode'`). Both extend `TransformError`, which extends `BaseError`, so every field on the base class (`code`, `message`, `cause`, `retryable`) is available.

Custom decode or encode functions may throw `DecodeError` or `EncodeError` directly. The library propagates the thrown instance unchanged: message, code, and any `path` or `schemaId` set by the caller are preserved. The library fills in missing `schemaId` context automatically.

<RunnableExample src="examples/docs/transforms/13-transform-errors" />

See [Error class hierarchy](/errors/classes) for the full reference on `TransformError`, `DecodeError`, `EncodeError`, and `CoercionError`.

## See also

- [Bookstore domain](/bookstore-domain) - schemas referenced in examples
