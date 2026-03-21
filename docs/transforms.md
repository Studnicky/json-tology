# Transforms

`Transform` attaches decode/encode functions to schemas without mutating them (stored in a WeakMap). `coerce()` decodes wire format to domain types; `encode()` reverses the conversion.

Import `Transform` from `'json-tology'` or `'json-tology/schema'`.

## API

- `Transform.create(schema, { decode, encode })` -- attach a transform pair, returns a typed schema
- `Transform.brand(schema, brandName)` -- compile-time brand (no runtime effect), for nominal typing
- `Transform.pipe(schema, transforms[])` -- chain transforms (decode left-to-right, encode right-to-left)
- `Transform.getDecoder(schema)` -- retrieve the transform pair registered on a schema
- `jt.coerce(schema, data)` -- validates, then applies decode
- `jt.encode(schema, value)` -- applies encode (domain to wire)

## Simple

`Transform.create()` attaches a Date transform. After registration, `coerce()` returns a `Date` instead of a raw string.

```ts
import { JsonTology, Transform } from 'json-tology';
const DateSchema = Transform.create(
  {
    $id: 'https://example.com/DateTime',
    type: 'string',
    format: 'date-time',
  } as const,
  {
    decode: (raw: string) => new Date(raw),
    encode: (date: Date) => date.toISOString(),
  },
);

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [TransformedDate] as const,
});

const date = jt.coerce(TransformedDate.$id, '2024-06-01T00:00:00.000Z');
console.log(date instanceof Date); // true
console.log(date.getFullYear());   // 2024
```

## Typical

### Nominal typing with brand

`Transform.brand` adds a compile-time brand. Both `UserId` and `OrderId` are strings at runtime, but TypeScript treats them as distinct types.

```ts
import { JsonTology, Transform } from 'json-tology';
import type { BrandOutputType } from 'json-tology';

const UserIdSchema = Transform.brand(
  { $id: 'https://example.com/UserId', type: 'string' } as const,
  'UserId',
);

const OrderIdSchema = Transform.brand(
  { $id: 'https://example.com/OrderId', type: 'string' } as const,
  'OrderId',
);

type UserId = BrandOutputType<typeof UserIdSchema>;
type OrderId = BrandOutputType<typeof OrderIdSchema>;

// UserId and OrderId are incompatible at the type level:
// const uid: UserId = 'abc' as OrderId; // type error
```

### Chaining with pipe

`Transform.pipe` composes multiple transforms. Decode runs left-to-right, encode runs right-to-left.

```ts
import { JsonTology, Transform } from 'json-tology';

const MoneySchema = {
  $id: 'https://example.com/Money',
  type: 'string',
} as const;

const TransformedMoney = Transform.pipe<typeof MoneySchema, number>(MoneySchema, [
  { decode: (s: string) => s.replace(/[$,]/g, ''), encode: (s: string) => `$${s}` },
  { decode: (s: string) => parseFloat(s), encode: (n: number) => n.toFixed(2) },
]);

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [TransformedMoney] as const,
});

const cents = jt.coerce(TransformedMoney.$id, '$1,234.56');
console.log(cents); // 1234.56
```

## Advanced

### Full roundtrip: coerce then encode

`coerce()` decodes wire to domain. `encode()` reverses domain back to wire.

```ts
import { JsonTology, Transform } from 'json-tology';

const DateSchema = {
  $id: 'https://example.com/DateTime',
  type: 'string',
  format: 'date-time',
} as const;

const TransformedDate = Transform.create(DateSchema, {
  decode: (raw: string) => new Date(raw),
  encode: (date: Date) => date.toISOString(),
});

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [TransformedDate] as const,
});

// Wire -> Domain
const date = jt.coerce(TransformedDate.$id, '2024-06-01T00:00:00.000Z');
console.log(date instanceof Date); // true

// Domain -> Wire
const wire = jt.encode(TransformedDate, date);
console.log(wire);           // '2024-06-01T00:00:00.000Z'
console.log(typeof wire);    // 'string'

// Validation still applies -- coerce throws CoercionError on invalid input
try {
  jt.coerce(TransformedDate.$id, 'not-a-date');
} catch (err) {
  console.log(err.constructor.name); // 'CoercionError'
}
```

### Inspecting registered transforms

`Transform.getDecoder` returns the `{ decode, encode }` pair, or `undefined` if no transform is attached.

```ts
import { Transform } from 'json-tology';

const Schema = {
  $id: 'https://example.com/Num',
  type: 'string',
} as const;

const Transformed = Transform.create(Schema, {
  decode: (s: string) => parseInt(s, 10),
  encode: (n: number) => String(n),
});

const fns = Transform.getDecoder(Transformed);
console.log(fns?.decode('42'));  // 42
console.log(fns?.encode(42));   // '42'

// Schema without a transform
const Plain = { $id: 'https://example.com/Plain', type: 'string' } as const;
console.log(Transform.getDecoder(Plain)); // undefined
```
