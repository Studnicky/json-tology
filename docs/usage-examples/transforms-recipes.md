# Transform recipes

Working recipes for everyday transform problems. Each recipe is a `Transform.create` (or `Transform.chain`) call, registered with the rest of the bookstore domain, that round-trips through `jt.instantiate` and `jt.encode`.

All recipes use the [bookstore domain](/bookstore-domain). For the underlying APIs see [`Transform.create` and `jt.encode`](/transforms/decode-encode), [`Transform.chain`](/transforms/chain), and [`Transform.brand`](/transforms/brand).

---

## Date and time

### ISO 8601 date-time string to `Date`

Wire format: `'2026-01-15T10:30:00Z'`. Decoded type: `Date`.

<<< ../../examples/docs/usage-examples/03-transforms-recipes.ts

Symmetric and lossless: `encode(decode(x)) === x` for any RFC 3339 string.

### Date-only string to `Date` at UTC midnight

Wire format: `'2026-01-15'`. The bare date format does not carry a time zone, so the decoder pins it to UTC midnight; the encoder strips the time component on the way out.

<<< ../../examples/docs/usage-examples/04-transforms-date-only.ts

### Unix epoch milliseconds to `Date`

Wire format: integer milliseconds since the epoch.

```ts
const TimestampSchema = Transform.create(
  { $id: 'urn:bookstore:Timestamp', type: 'integer', minimum: 0 } as const,
  {
    decode: (ms: number) => new Date(ms),
    encode: (d: Date)    => d.getTime()
  }
);
```

For seconds-since-epoch swap `* 1000` and `/ 1000`.

### Temporal API plain date

If your runtime ships [`Temporal`](https://tc39.es/proposal-temporal/), prefer `Temporal.PlainDate` over `Date` for calendar values - it has no time zone and no time component, so it round-trips cleanly without the UTC-midnight workaround.

```ts
const ReleaseDateSchema = Transform.create(
  { $id: 'urn:bookstore:ReleaseDate', type: 'string', format: 'date' } as const,
  {
    decode: (s: string) => Temporal.PlainDate.from(s),
    encode: (d: Temporal.PlainDate) => d.toString()
  }
);
```

---

## Money and numerics

### Cents (integer) to a decimal type

Storing money as integer cents avoids floating-point error. Decode to a `Decimal` from your library of choice (e.g. `decimal.js`), encode back to cents.

```ts
import Decimal from 'decimal.js';

const PriceCentsSchema = Transform.create(
  { $id: 'urn:bookstore:PriceCents', type: 'integer', minimum: 0 } as const,
  {
    decode: (cents: number)  => new Decimal(cents).div(100),
    encode: (amount: Decimal) => amount.mul(100).toNumber()
  }
);
```

If you prefer the project's built-in [Money composite](/bookstore-domain#money), keep cents as the wire format and use Money for the decoded slot.

### Formatted string to float (multi-step chain)

Wire format: `'$1,234.56'`. Two decoders run left to right; encoders run right to left.

```ts
const FormattedPriceSchema = Transform.chain(
  { $id: 'urn:bookstore:FormattedPrice', type: 'string' } as const,
  [
    {
      decode: (s: string) => s.replace(/[$,]/g, ''),
      encode: (s: string) => `$${s}`
    },
    {
      decode: (s: string) => parseFloat(s),
      encode: (n: number) => n.toFixed(2)
    }
  ]
);
```

`jt.instantiate(..., '$1,234.56')` yields `1234.56`; `jt.encode(..., 1234.56)` yields `'$1234.56'`. (Note the encoder does not re-insert thousands separators - that is a one-way concern; add a third stage if your wire format requires it on the way out.)

### BigInt-shaped identifiers

JSON cannot natively represent `BigInt`. Stringify on the wire; parse on decode.

```ts
const BigIdSchema = Transform.create(
  { $id: 'urn:bookstore:BigId', type: 'string', pattern: '^\\d+$' } as const,
  {
    decode: (s: string) => BigInt(s),
    encode: (n: bigint) => n.toString()
  }
);
```

---

## Identifiers and strings

### Email normalization (lowercase, trim)

Validation alone does not normalize. Use a transform when you want the canonical form on every read.

```ts
const NormalizedEmailSchema = Transform.create(
  { $id: 'urn:bookstore:NormalizedEmail', type: 'string', format: 'email' } as const,
  {
    decode: (raw: string) => raw.trim().toLowerCase(),
    encode: (e: string)   => e
  }
);
```

The encoder is the identity, so the wire form preserves whatever the decoder produced. If you need to track the original, register a sibling property.

### URL string to `URL` object

```ts
const HrefSchema = Transform.create(
  { $id: 'urn:bookstore:Href', type: 'string', format: 'uri' } as const,
  {
    decode: (s: string) => new URL(s),
    encode: (u: URL)    => u.toString()
  }
);
```

### Slug normalization

```ts
const SlugSchema = Transform.create(
  { $id: 'urn:bookstore:Slug', type: 'string' } as const,
  {
    decode: (raw: string) => raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    encode: (s: string)   => s
  }
);
```

Pair with the [custom `slug` format](/usage-examples/custom-formats) if you also want validation.

---

## Encoded payloads

### Base64 string to `Uint8Array`

```ts
const BinarySchema = Transform.create(
  { $id: 'urn:bookstore:Binary', type: 'string', contentEncoding: 'base64' } as const,
  {
    decode: (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
    encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  }
);
```

For Node, swap `atob`/`btoa` for `Buffer.from(b64, 'base64')` / `buf.toString('base64')`.

### JSON string to a parsed object

```ts
const JsonBlobSchema = Transform.create(
  { $id: 'urn:bookstore:JsonBlob', type: 'string' } as const,
  {
    decode: (s: string) => JSON.parse(s) as unknown,
    encode: (v: unknown) => JSON.stringify(v)
  }
);
```

Validation runs against the wire `string`. If you want the decoded value validated too, register the inner schema separately and use a `$ref` rather than a transform.

---

## Collections

### Comma-separated string to `string[]`

Wire format: `'fiction, paperback, bestseller'`. Decoded type: `string[]`.

```ts
const TagListSchema = Transform.create(
  { $id: 'urn:bookstore:TagList', type: 'string' } as const,
  {
    decode: (s: string)    => s.split(',').map(t => t.trim()).filter(Boolean),
    encode: (arr: string[]) => arr.join(', ')
  }
);
```

If both ends of the wire are an array, prefer a plain `type: 'array'` schema with no transform.

---

## Branded types

### Branded primitive plus decode

`Transform.brand` attaches a phantom brand to the inferred type without changing the wire format. Compose it with `Transform.create` when you also need a runtime conversion.

```ts
import type { BrandedType } from 'json-tology/types';

const IsbnSchema = Transform.brand(
  { $id: 'urn:bookstore:Isbn', type: 'string', pattern: '^[0-9X]{10,13}$' } as const,
  'Isbn'
);

type Isbn = BrandedType<string, 'Isbn'>;
// jt.instantiate(IsbnSchema.$id, '9780140449136') is typed as Isbn,
// distinguishable from a plain string at compile time.
```

To brand AND convert, chain via `Transform.create` on the branded schema.

---

## Round-trip discipline

A transform is **lossless** when `encode(decode(x)) === x` and `decode(encode(y)) === y` for every value in the domain. Recipes in this page that pass this test:

- ISO 8601 date-time to `Date` (string-form normalizes, but every valid input maps to a unique output).
- Unix epoch milliseconds.
- Temporal `PlainDate`.
- Cents to `Decimal`.
- Branded primitives.
- Pure normalization where the encoder is the identity (email lowercase, slug) - lossy in one direction by design.

If your recipe is lossy, document which direction loses information and what the canonical form is.

### Property test pattern

```ts
import { strict as assert } from 'node:assert';

function roundTrip<T>(schema: { $id: string }, samples: readonly unknown[]): void {
  for (const wire of samples) {
    const decoded = jt.instantiate(schema.$id, wire);
    const reEncoded = jt.encode(schema, decoded);
    assert.deepEqual(reEncoded, wire);
  }
}

roundTrip(PlacedAtSchema, ['2026-01-15T10:30:00.000Z']);
```

---

## When NOT to use a transform

- **The wire format is already the desired runtime type.** Use a plain schema and skip the transform.
- **You need cross-field logic.** Use `addInvariant` or `jt:computed`.
- **You only want to filter unknown properties.** Use `enableTypeCast` or `Compose.pick`.
- **You want different runtime types per consumer.** A transform is global to the schema's `$id`. Use sibling schemas if call sites need different decoded shapes.

---

## Related

- [`Transform.create` and `jt.encode`](/transforms/decode-encode) - the underlying API
- [`Transform.chain`](/transforms/chain) - multi-stage chains, decode/encode direction
- [`Transform.brand`](/transforms/brand) - nominal typing without runtime conversion
- [Custom formats](/usage-examples/custom-formats) - validate the wire format before decoding

## See also

- [Bookstore domain](/bookstore-domain) - where `IsbnSchema`, `Money`, `OrderSchema` are defined
- [Sub-schemas and `$ref` composition](/advanced/sub-schemas) - registering once, referencing everywhere
- [Picking a method](/picking-a-method) - when to use `instantiate` vs `validate` vs `materialize`
