# Transforms

> This guide covers `Transform.create`, `Transform.brand`, `Transform.pipe`, `Transform.getDecoder`, and `jt.encode`. All examples use the [bookstore domain](/bookstore-domain). See [Validation](/validation#coerce) for how `coerce` applies transform decoders automatically.

`Transform` attaches decode/encode functions to a schema without mutating it (stored in a WeakMap). After a transform is registered, `coerce()` automatically applies the decoder after validation — the TypeScript return type changes from the wire type to the decoded type. `encode()` reverses the transformation for serialization.

---

## Transform.create

Attaches decode and encode functions to a schema.

### Signature

```ts
public static create<TSchema, TOut>(
  schema: TSchema,
  fns: {
    decode: (input: InferSchemaType<TSchema>) => TOut;
    encode: (output: TOut) => InferSchemaType<TSchema>;
  }
): TransformedType<TSchema, TOut>
```

Returns the same schema object at runtime; the TypeScript return type is widened to `TransformedType<TSchema, TOut>`. The schema object is never mutated.

### When to use

Use `Transform.create` when you want `coerce()` to automatically convert a wire-format value into a richer domain type. Common cases: ISO date strings → `Date`, cents integers → `Decimal`, raw enum strings → enums. Pair with `jt.encode()` to serialize domain values back to wire format.

### Examples

#### Example 1: ISO datetime strings to Date objects

`placedAt` in `OrderSchema` is a `date-time` format string on the wire. Attach a transform so `coerce()` returns a `Date` object.

```ts
import { Transform, JsonTology } from 'json-tology';

const PlacedAtSchema = Transform.create(
  {
    $id: 'https://bookstore.example/PlacedAt',
    type: 'string',
    format: 'date-time',
  } as const,
  {
    decode: (s: string) => new Date(s),
    encode: (d: Date) => d.toISOString(),
  },
);

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [PlacedAtSchema] as const,
});

const date = jt.coerce(PlacedAtSchema.$id, '2026-01-15T10:30:00Z');
console.log(date instanceof Date);  // true
console.log(date.getFullYear());    // 2026
```

#### Example 2: Price in cents to decimal

```ts
const PriceCentsSchema = Transform.create(
  {
    $id: 'https://bookstore.example/PriceCents',
    type: 'integer',
    minimum: 0,
  } as const,
  {
    decode: (cents: number) => cents / 100,
    encode: (dollars: number) => Math.round(dollars * 100),
  },
);

const jt2 = jt.register(PriceCentsSchema);

const price = jt2.coerce(PriceCentsSchema.$id, 1499);
console.log(price); // 14.99

// Encode back to wire form:
const wire = jt2.encode(PriceCentsSchema, price);
console.log(wire); // 1499
```

#### Example 3: Full round-trip — coerce then encode

`coerce()` decodes wire → domain. `encode()` converts domain → wire. The round-trip recovers the original wire value.

```ts
const raw = '2026-01-15T10:30:00.000Z';
const date = jt.coerce(PlacedAtSchema.$id, raw);

// Round-trip:
const wire = jt.encode(PlacedAtSchema, date);
console.log(wire);          // '2026-01-15T10:30:00.000Z'
console.log(wire === raw);  // true

// Validation still applies — coerce throws on invalid input:
try {
  jt.coerce(PlacedAtSchema.$id, 'not-a-date');
} catch (err) {
  console.log(err.constructor.name); // 'CoercionError'
}
```

### Comparison

::: code-group

```ts [json-tology]
const PlacedAtSchema = Transform.create(
  { $id: 'https://bookstore.example/PlacedAt', type: 'string', format: 'date-time' } as const,
  { decode: (s: string) => new Date(s), encode: (d: Date) => d.toISOString() },
);
// jt.coerce(PlacedAtSchema.$id, '2026-01-15T10:30:00Z') → Date
```

```ts [Zod]
const PlacedAtSchema = z.string().datetime().transform(s => new Date(s));
// .parse('2026-01-15T10:30:00Z') → Date
// Encode requires a separate schema or manual call.
```

```ts [TypeBox]
// TypeBox does not have a built-in transform mechanism.
// Apply transformations manually after validation:
const C = TypeCompiler.Compile(Type.String({ format: 'date-time' }));
if (C.Check(raw)) {
  const date = new Date(raw);
}
```

```ts [AJV]
// AJV validates only — no transform/decode built in.
// Apply manually:
if (ajv.validate({ type: 'string', format: 'date-time' }, raw)) {
  const date = new Date(raw);
}
```

```py [Pydantic]
from pydantic import BaseModel
from datetime import datetime

class Order(BaseModel):
    placed_at: datetime  # Pydantic automatically converts ISO strings to datetime
```

:::

### Related

- `jt.encode` — convert decoded value back to wire format
- `Transform.pipe` — compose multiple transform steps
- `Transform.brand` — compile-time nominal typing (no decode/encode)
- [Serialization](/dump) — `dump()` applies `encode` when walking the schema graph

---

## Transform.brand

Attaches a compile-time nominal brand to a schema. No runtime effect — the schema object is returned unchanged.

### Signature

```ts
public static brand<TSchema, TBrand extends string>(
  schema: TSchema,
  _: TBrand
): BrandedType<TSchema, TBrand>
```

### When to use

Use to create nominally distinct string types for IDs and identifiers that are structurally identical (`string`) but must not be mixed up. `CustomerId` and `OrderId` are both UUIDs at runtime, but TypeScript prevents passing one where the other is expected.

### Examples

#### Example 1: Branded customer and order IDs

```ts
import { Transform } from 'json-tology';
import type { BrandOutputType } from 'json-tology';

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

// These are incompatible at compile time — both string at runtime:
// const cid: CustomerId = 'abc' as OrderId; // compile error

function lookupCustomer(id: CustomerId) { /* ... */ }
function lookupOrder(id: OrderId) { /* ... */ }
```

#### Example 2: Branded ISBN

```ts
const IsbnSchema = Transform.brand(
  {
    $id:     'https://bookstore.example/ISBN',
    type:    'string',
    pattern: '^\\d{13}$',
  } as const,
  'ISBN13',
);

type ISBN13 = BrandOutputType<typeof IsbnSchema>;

function lookupBook(isbn: ISBN13) { /* ... */ }
// lookupBook('9780140449136')            // compile error — plain string not branded
// lookupBook(jt.coerce(IsbnSchema.$id, '9780140449136')) // ok — brand obtained via coerce
```

### Comparison

::: code-group

```ts [json-tology]
const CustomerIdSchema = Transform.brand(
  { $id: '...', type: 'string', format: 'uuid' } as const,
  'CustomerId',
);
type CustomerId = BrandOutputType<typeof CustomerIdSchema>;
```

```ts [Zod]
const CustomerIdSchema = z.string().uuid().brand<'CustomerId'>();
type CustomerId = z.infer<typeof CustomerIdSchema>;
```

```ts [TypeBox]
// TypeBox does not have a built-in brand utility.
// Use TypeScript's type-level branding manually:
type CustomerId = string & { readonly __brand: 'CustomerId' };
```

```ts [AJV]
// Not applicable — AJV provides no type-level nominal typing.
```

```py [Pydantic]
from typing import Annotated
from pydantic import BeforeValidator

# Pydantic uses NewType for nominal types:
from typing import NewType
CustomerId = NewType('CustomerId', str)
```

:::

### Related

- [Constraint Brands](/constraint-brands) — automatic brands from JSON Schema keywords (`format`, `pattern`, etc.)
- `Transform.create` — decode/encode transforms with runtime effect

---

## Transform.pipe

Composes multiple transforms into a single pipeline attached to a schema. Decode runs left-to-right; encode runs right-to-left.

### Signature

```ts
public static pipe<TSchema, TOut>(
  schema: TSchema,
  transforms: Array<{
    decode: (value: unknown) => unknown;
    encode: (value: unknown) => unknown;
  }>
): TransformedType<TSchema, TOut>
```

### When to use

Use when a single wire value needs multiple transformation steps — for example, stripping formatting characters from a price string, then converting the result to a float. The pipe composes the steps so `coerce()` runs them all in sequence.

### Examples

#### Example 1: Formatted price string to float

```ts
import { Transform, JsonTology } from 'json-tology';

const FormattedPriceSchema = Transform.pipe<
  typeof BookSchema.properties.price,
  number
>(
  // Start from a string schema representing the wire format
  {
    $id:  'https://bookstore.example/FormattedPrice',
    type: 'string',
  } as const,
  [
    // Step 1: Strip currency symbol and commas
    {
      decode: (s: unknown) => (s as string).replace(/[$,]/g, ''),
      encode: (s: unknown) => `$${(s as string)}`,
    },
    // Step 2: Parse to float
    {
      decode: (s: unknown) => parseFloat(s as string),
      encode: (n: unknown) => (n as number).toFixed(2),
    },
  ],
);

const jt2 = jt.register(FormattedPriceSchema);

const price = jt2.coerce(FormattedPriceSchema.$id, '$14.99');
console.log(price); // 14.99

const wire = jt2.encode(FormattedPriceSchema, price);
console.log(wire);  // '14.99' (formatted by encode chain in reverse)
```

#### Example 2: Decode ISO date then extract year

```ts
const YearSchema = Transform.pipe<
  { $id: 'https://bookstore.example/Year'; type: 'string'; format: 'date-time' },
  number
>(
  {
    $id:    'https://bookstore.example/Year',
    type:   'string',
    format: 'date-time',
  } as const,
  [
    { decode: (s: unknown) => new Date(s as string),       encode: (d: unknown) => (d as Date).toISOString() },
    { decode: (d: unknown) => (d as Date).getFullYear(),   encode: (y: unknown) => new Date((y as number), 0, 1).toISOString() },
  ],
);

const jt3 = jt.register(YearSchema);
const year = jt3.coerce(YearSchema.$id, '2026-01-15T10:30:00Z');
console.log(year); // 2026
```

### Comparison

::: code-group

```ts [json-tology]
const PriceSchema = Transform.pipe<typeof BaseSchema, number>(BaseSchema, [
  { decode: s => s.replace(/[$,]/g, ''), encode: s => `$${s}` },
  { decode: s => parseFloat(s),          encode: n => n.toFixed(2) },
]);
```

```ts [Zod]
const PriceSchema = z.string()
  .transform(s => s.replace(/[$,]/g, ''))
  .transform(s => parseFloat(s));
// Zod chains transforms sequentially — no built-in encode reversal.
```

```ts [TypeBox]
// Not built in — apply transformations manually after validation.
```

```ts [AJV]
// Not built in.
```

```py [Pydantic]
from pydantic import field_validator, model_validator

class PricedItem(BaseModel):
    price: float

    @field_validator('price', mode='before')
    @classmethod
    def parse_price(cls, v):
        if isinstance(v, str):
            return float(v.replace('$', '').replace(',', ''))
        return v
```

:::

### Related

- `Transform.create` — single decode/encode pair
- `jt.encode` — reverse a transform for serialization

---

## Transform.getDecoder

Returns the decode/encode function pair registered on a schema, or `undefined` if no transform is attached.

### Signature

```ts
public static getDecoder(schema: object): TransformFnsInterface | undefined
```

### When to use

Use in custom serializers or middleware that need to apply transforms outside the normal `coerce`/`encode` flow. Most application code should use `coerce` and `encode` directly.

### Examples

#### Example 1: Inspect a registered transform

```ts
const fns = Transform.getDecoder(PlacedAtSchema);
console.log(fns?.decode('2026-01-15T10:30:00.000Z') instanceof Date); // true
console.log(fns?.encode(new Date('2026-01-15T10:30:00.000Z')));       // '2026-01-15T10:30:00.000Z'
```

#### Example 2: Check whether a schema has a transform

```ts
const plain = { $id: 'https://bookstore.example/Plain', type: 'string' } as const;
console.log(Transform.getDecoder(plain));         // undefined
console.log(Transform.getDecoder(PlacedAtSchema)); // { decode: fn, encode: fn }
```

---

## jt.encode

Encodes a decoded (domain) value back to its wire representation using the schema's registered transform.

### Signature

```ts
public encode<TSchema, TOut>(
  schema: TransformedType<TSchema, TOut>,
  value: TOut
): InferSchemaType<TSchema>
```

### When to use

Use after `coerce()` when you need to send the domain value back over the wire — for example, serializing a `Date` back to ISO string before storing in a database. Pairs with `coerce()` for full round-trip: wire → domain → wire.

### Examples

#### Example 1: Round-trip a placement date

```ts
// Wire → Domain
const date = jt.coerce(PlacedAtSchema.$id, '2026-01-15T10:30:00.000Z');
console.log(date instanceof Date); // true

// Domain → Wire
const wire = jt.encode(PlacedAtSchema, date);
console.log(wire); // '2026-01-15T10:30:00.000Z'
console.log(typeof wire); // 'string'
```

#### Example 2: Serialize for database storage

```ts
// After processing an order with Date fields:
const orderDate: Date = jt.coerce(PlacedAtSchema.$id, event.placedAt);
// ... do business logic with Date ...

// Before writing to DB:
const dbRecord = {
  ...order,
  placedAt: jt.encode(PlacedAtSchema, orderDate), // back to ISO string
};
```

### Comparison

::: code-group

```ts [json-tology]
const wire = jt.encode(PlacedAtSchema, date); // Date → string
```

```ts [Zod]
// Zod uses output types — encode is not built in.
// Call .toISOString() manually:
const wire = date.toISOString();
```

```ts [TypeBox]
// Not built in — encode manually.
```

```ts [AJV]
// Not built in.
```

```py [Pydantic]
# model_dump() with mode='json' serializes datetime to ISO string:
wire = order.model_dump(mode='json')['placed_at']  # str
```

:::

### Related

- `Transform.create` — where the encode function is registered
- [Serialization](/dump) — `dump()` applies `encode` as part of graph-walking serialization
