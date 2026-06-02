# `instantiate` vs `materialize`

Both methods validate and return a typed value. The difference is **where the data came from** and **whether registered Transform decoders run**.

## Decision table

| Question | Answer | Use |
|---|---|---|
| Did this data arrive from outside your process? | Yes — HTTP body, queue message, config file, IPC payload | `instantiate` |
| Did you produce this data yourself? | Yes — test fixture, form scaffold, factory method | `materialize` |
| Does the schema have a registered `Transform` decoder? | Yes, and the data needs decoding | `instantiate` |
| Do you want defaults filled without running decoders? | Yes | `materialize` |
| Is the data untrusted? | Yes | `instantiate` |

## What each method does

### `instantiate(schema, data)` — the wire-decode entry point

`instantiate` is the **trust boundary** method. Call it whenever data crosses into your system from outside.

It does four things in order:
1. Deep-clones the input (the original is never mutated).
2. Validates against the schema; throws `InstantiationError` on failure.
3. Resolves `$ref`s recursively via the registered `RefDecoder`.
4. **Runs every registered `Transform` decoder** on the validated value.

The returned value is the decoded, branded runtime type — `Customer`, not `{ id: string, email: string, … }`.

```ts
import { InstantiationError } from 'json-tology';
import { bookstoreEntities } from './bookstore/index.js';
import { CustomerSchema } from './bookstore/entities/Customer.js';

// HTTP request handler — data came from outside, use instantiate
async function handleCreateOrder(rawBody: unknown) {
  const customer = bookstoreEntities.instantiate(CustomerSchema.$id, rawBody);
  // customer is typed as Customer
  // Transform decoders ran (e.g. a customerId UUID decoder)
  // unknown properties stripped, defaults filled
}
```

### `materialize(schema, partial?)` — defaults and scaffolding without decode overhead

`materialize` is the **construction helper**. Call it when you produce the data yourself and want schema defaults filled in.

It does three things:
1. Merges the optional partial input with the schema's declared `default` values.
2. Validates the merged result; throws `MaterializationError` on failure (pass `{ enablePartial: true }` to allow missing required fields during lenient construction).
3. Returns the merged, validated value.

**`materialize` does not run Transform decoders.** The data is already in its final runtime shape — no decode step is needed or expected.

```ts
import { bookstoreEntities } from './bookstore/index.js';
import { BookSchema } from './bookstore/entities/Book.js';

// Test fixture — data you produced, use materialize
const fixture = bookstoreEntities.materialize(BookSchema, {
  isbn: '9781234567890',
  title: 'Effective Schemas',
  authors: ['A. Studnicky'],
  price: { amount: 39.99, currency: 'USD' },
});
// currency filled from schema default if omitted
// NO Transform decoders run — this is already your data
```

## Transforms: why they matter for the choice

A `Transform` registered on a schema pairs a decoder and an encoder:

```ts
import { Transform } from 'json-tology';
import { CustomerIdSchema } from './bookstore/entities/CustomerId.js';

// The decoder runs at instantiate time, not at materialize time
Transform.create(CustomerIdSchema, {
  decode: (raw) => raw.trim().toLowerCase(),
  encode: (value) => value,
});
```

When `instantiate` runs, every `$ref`-resolved property that has a registered `Transform` decoder runs its `decode` function. This is how wire data (raw strings, dates as ISO strings, CURIEs) becomes your domain type.

`materialize` skips this step entirely — the data you pass in is already your domain shape. Calling `materialize` on wire data where a decoder is registered means the decoder never runs and the returned value is the undecoded wire form, not the domain type.

**State plainly:** decode boundary data with `instantiate`; use `materialize` for fixtures and form scaffolding where transform overhead is not needed and the data is already correct.

## Common misuse pattern

```ts
// WRONG — materialize skips Transform decoders
// If CustomerId has a registered decoder, it never runs here
const customer = bookstoreEntities.materialize(CustomerSchema, wireBody);

// CORRECT — instantiate runs decoders, validates, strips unknowns
const customer = bookstoreEntities.instantiate(CustomerSchema.$id, wireBody);
```

The instinct to reach for `materialize` on untrusted input is the most common source of "my decoder isn't running" reports. If the data came from outside, use `instantiate`.

## `enablePartial` on `materialize`

For forms or partial construction where some required fields are legitimately absent:

```ts
const draft = bookstoreEntities.materialize(BookSchema, {
  isbn: '9781234567890',
}, { enablePartial: true });
// validates what's present, fills what has defaults, skips required-without-default fields
```

This option has no equivalent on `instantiate` — every required field must be present in untrusted input.

## Summary

| | `instantiate` | `materialize` |
|---|---|---|
| Data origin | Outside (untrusted) | Inside (you produced it) |
| Runs Transform decoders | **Yes** | No |
| Resolves `$ref` decoders | Yes | No |
| Fills `default` values | Yes | Yes |
| Strips unknown properties | Yes | No |
| Partial construction option | No | `{ enablePartial: true }` |
| Throws on failure | `InstantiationError` | `MaterializationError` |

## Related

- [`instantiate` reference](/validation/instantiate) — full option reference and examples
- [`materialize` reference](/registry/materialize) — construction helper examples
- [Picking a method](/picking-a-method) — broader decision guide including `validate` and `is`
- [Transforms](/transforms/decode-encode) — how `Transform.create` registers a decoder
