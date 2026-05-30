# Transform recipes

Working recipes for everyday transform problems. Each recipe is a `Transform.create` (or `Transform.chain`) call, registered with the rest of the bookstore domain, that round-trips through `jt.instantiate` and `jt.encode`.

All recipes use the [bookstore domain](/bookstore-domain). For the underlying APIs see [`Transform.create` and `jt.encode`](/transforms/decode-encode), [`Transform.chain`](/transforms/chain), and [`Transform.brand`](/transforms/brand).

---

## Date and time

### ISO 8601 date-time string to `Date`

Wire format: `'2026-01-15T10:30:00Z'`. Decoded type: `Date`.

<RunnableExample src="examples/docs/usage-examples/03-transforms-recipes" />

Symmetric and lossless: `encode(decode(x)) === x` for any RFC 3339 string.

### Date-only string to `Date` at UTC midnight

Wire format: `'2026-01-15'`. The bare date format does not carry a time zone, so the decoder pins it to UTC midnight; the encoder strips the time component on the way out.

<RunnableExample src="examples/docs/usage-examples/04-transforms-date-only" />

### Unix epoch milliseconds to `Date`

Wire format: integer milliseconds since the epoch.

<RunnableExample src="examples/docs/usage-examples/06-transforms-epoch-ms" />

For seconds-since-epoch swap `* 1000` and `/ 1000`.

### Temporal API plain date

If your runtime ships [`Temporal`](https://tc39.es/proposal-temporal/), prefer `Temporal.PlainDate` over `Date` for calendar values - it has no time zone and no time component, so it round-trips cleanly without the UTC-midnight workaround. The runnable example below uses a hand-rolled `PlainDate` analogue because the `Temporal` global is not yet a stable Node.js builtin; swap the class for `Temporal.PlainDate` once your runtime ships it.

<RunnableExample src="examples/docs/usage-examples/08-transforms-plain-date" />

---

## Money and numerics

### Cents (integer) to a decimal type

Storing money as integer cents avoids floating-point error. Decode to a `Decimal` from your library of choice (e.g. `decimal.js`), encode back to cents. The runnable example below uses a `bigint`-backed `BigCents` wrapper so it has no external dependency; swap the wrapper for `Decimal` (or your own arbitrary-precision type) when integrating.

<RunnableExample src="examples/docs/usage-examples/09-transforms-cents-bigcents" />

If you prefer the project's built-in [Money composite](/bookstore-domain#money), keep cents as the wire format and use Money for the decoded slot.

### Formatted string to float (multi-step chain)

Wire format: `'$1,234.56'`. Two decoders run left to right; encoders run right to left.

<RunnableExample src="examples/docs/usage-examples/07-transforms-formatted-price" />

`jt.instantiate(..., '$1,234.56')` yields `1234.56`; `jt.encode(..., 1234.56)` yields `'$1234.56'`. (Note the encoder does not re-insert thousands separators - that is a one-way concern; add a third stage if your wire format requires it on the way out.)

### BigInt-shaped identifiers

JSON cannot natively represent `BigInt`. Stringify on the wire; parse on decode.

<RunnableExample src="examples/docs/usage-examples/10-transforms-bigint-id" />

---

## Identifiers and strings

### Email normalization (lowercase, trim)

Validation alone does not normalize. Use a transform when you want the canonical form on every read.

<RunnableExample src="examples/docs/usage-examples/11-transforms-email-normalize" />

The encoder is the identity, so the wire form preserves whatever the decoder produced. If you need to track the original, register a sibling property.

### URL string to `URL` object

<RunnableExample src="examples/docs/usage-examples/12-transforms-url" />

### Slug normalization

<RunnableExample src="examples/docs/usage-examples/13-transforms-slug" />

Pair with the [custom `slug` format](/usage-examples/custom-formats) if you also want validation.

---

## Encoded payloads

### Base64 string to `Uint8Array`

<RunnableExample src="examples/docs/usage-examples/14-transforms-base64" />

For browsers, swap `Buffer.from(b64, 'base64')` for `Uint8Array.from(atob(b64), c => c.charCodeAt(0))` and the encoder for `btoa(String.fromCharCode(...bytes))`.

### JSON string to a parsed object

<RunnableExample src="examples/docs/usage-examples/15-transforms-json-blob" />

Validation runs against the wire `string`. If you want the decoded value validated too, register the inner schema separately and use a `$ref` rather than a transform.

---

## Collections

### Comma-separated string to `string[]`

Wire format: `'fiction, paperback, bestseller'`. Decoded type: `string[]`.

<RunnableExample src="examples/docs/usage-examples/16-transforms-csv-tags" />

If both ends of the wire are an array, prefer a plain `type: 'array'` schema with no transform.

---

## Branded types

### Branded primitive plus decode

`Transform.brand` attaches a phantom brand to the inferred type without changing the wire format. Compose it with `Transform.create` when you also need a runtime conversion.

<RunnableExample src="examples/docs/usage-examples/17-transforms-brand-isbn" />

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

<<< ../../examples/docs/usage-examples/18-transforms-property-test.ts

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
