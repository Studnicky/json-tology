# `JsonTology.instantiate`

**Trust boundary.** Use `instantiate` when data crosses into your system from outside - HTTP request bodies, queue messages, file imports, IPC payloads. Failure means the caller sent invalid data; `InstantiationError` carries the full structured error list for your error response.

**Declaration.** Validates input data against a registered schema, applies `default` values declared on schema properties, runs any registered `Transform` decoders, strips unknown properties, and returns a fully typed result. Throws `InstantiationError` on validation failure. The input is deep-cloned before mutation - the original is never modified.

**Use this when** you have an unknown-shape input (a request body, a queue message, a config blob, a database row) and you want a typed, validated, defaults-applied domain object - or a typed exception. This is the right method 80% of the time when data enters your application boundary. Prefer this over calling `validate` and then mapping fields manually.

**Don't use this when** you need just a yes/no answer without a throw (use [`is`](/validation/is) instead). Don't use it when you want the structured error list without the exception (use [`validate`](/validation/validate) instead). Don't call `instantiate` on already-coerced values - the result of `instantiate` is already clean and typed. Don't use `instantiate` inside a tight inner loop over millions of calls with a fixed schema - pull `jt.registry.validator(schemaId)` once and reuse the compiled validator.

## Examples

### Example 1: Validate and apply defaults

Valid input: unknown properties are stripped, defaults are filled, the return type is `Customer`.

```ts
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

const customer = jt.instantiate(CustomerSchema.$id, {
  id:            'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email:         'alice@bookstore.example',
  name:          'Alice Chen',
  internalNotes: 'vip',   // ← stripped  - not in schema
  // addresses omitted  - default [] applied
});
// customer is typed as Customer
// customer.addresses === []
// customer.internalNotes → compile error: property doesn't exist on Customer
```

### Example 2: Coerce as part of a request handler

Catch `InstantiationError` and convert to an RFC 7807 Problem Details response (built on [`errors.report`](/errors/views#validationerrors-report)).

```ts
import { InstantiationError } from 'json-tology';
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

function createCustomer(body: unknown) {
  try {
    return jt.instantiate(CustomerSchema.$id, body);
  } catch (err) {
    if (err instanceof InstantiationError) {
      // err.errors is a ValidationErrors collection
      return {
        status: 422,
        body:   err.errors.report({ instance: '/customers' }),
      };
    }
    throw err;
  }
}
```

### Example 3: Coerce a nested schema with $ref

`OrderSchema` contains `items: [OrderLine]` via `$ref`. Each `OrderLine` is coerced independently. See the [bookstore domain](/bookstore-domain) for schema definitions.

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';

const order = jt.instantiate(OrderSchema.$id, {
  id:              'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId:      'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:        '2026-01-15T10:30:00Z',
  total:           27.98,
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99, extra: 'gone' },
  ],
  unexpectedField: 'stripped',
});

// order.currency === 'USD' (default)
// order.items[0].extra is gone (stripped from OrderLine)
// order.unexpectedField gone (stripped from Order)
```

## Bad examples - what NOT to do

### Anti-pattern 1: Catching InstantiationError silently

```ts
// ⊥ Don't do this  - you lose the structured ValidationErrors
try {
  jt.instantiate(CustomerSchema.$id, data);
} catch {
  /* swallowed */
}

// ✓ Do this  - surface the error list
const errs = entities.validate(CustomerSchema.$id, data);
if (!errs.ok) {
  console.log(errs.items.map(e => `${e.path}: ${e.message}`));
}
```

### Anti-pattern 2: Coercing already-coerced values

```ts
// ⊥ Don't do this  - wasted work; coerce already returned a typed, clean value
const validated = jt.instantiate(CustomerSchema.$id, body);
const again     = jt.instantiate(CustomerSchema.$id, validated);

// ✓ Just use the first result
const customer = jt.instantiate(CustomerSchema.$id, body);
```

### Anti-pattern 3: Building partial shapes by hand instead of using derived schemas

```ts
import { Compose } from 'json-tology';

// ⊥ Don't do this  - build a sub-schema with Compose instead
const partial = { name: body.name, email: body.email };
jt.instantiate(CustomerSchema.$id, partial);

// ✓ Do this  - pick the sub-schema, coerce cleanly
const SignupSchema = Compose.pick(
  CustomerSchema,
  ['name', 'email'] as const,
  'https://bookstore.example/Signup',
);
jt.instantiate(SignupSchema.$id, body);
```

## Comparison

::: code-group

```ts [json-tology]
import { InstantiationError } from 'json-tology';

const customer = jt.instantiate(CustomerSchema.$id, rawData);
// throws InstantiationError on failure
// typed as Customer
// defaults applied, unknowns stripped, Transform decoders run
```

```ts [Zod]
import { z } from 'zod';

const CustomerSchema = z.object({
  id:    z.string().uuid(),
  email: z.string().email(),
  name:  z.string(),
  addresses: z.array(z.object({ street: z.string(), city: z.string(), postalCode: z.string() })).default([]),
});
const customer = CustomerSchema.parse(rawData);
// throws ZodError on failure
// typed; .default() fields filled; unknown keys stripped by default (.strip() mode)
```

```ts [Valibot]
import * as v from 'valibot';

const CustomerSchema = v.object({
  id:    v.pipe(v.string(), v.uuid()),
  email: v.pipe(v.string(), v.email()),
  name:  v.pipe(v.string(), v.minLength(1)),
  addresses: v.optional(v.array(v.object({
    street: v.string(), city: v.string(), postalCode: v.string(),
  })), []),
});
const customer = v.parse(CustomerSchema, rawData);
// throws ValiError on failure; typed via v.InferOutput
// Defaults flow through v.optional(schema, defaultValue), not via a registry option.
// Unknown keys stripped by default; no Transform decoder registry.
```

```ts [io-ts]
import * as t from 'io-ts';
import { isLeft } from 'fp-ts/Either';
import { PathReporter } from 'io-ts/PathReporter';

const CustomerCodec = t.exact(t.type({
  id:    t.string,
  email: t.string,
  name:  t.string,
}));
const result = CustomerCodec.decode(rawData);
if (isLeft(result)) {
  throw new Error(PathReporter.report(result).join('\n'));
}
const customer = result.right;
// Limitation: no native default-fill, no decoder registry, no
// InstantiationError class. t.exact strips unknown keys; merge defaults by
// hand before decode.
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
import { TypeCompiler } from '@sinclair/typebox/compiler';

const C = TypeCompiler.Compile(CustomerSchema);
// Two-step: default-fill, then check
const filled = Value.Default(CustomerSchema, Value.Clone(rawData));
if (!C.Check(filled)) {
  throw new Error([...C.Errors(filled)].map(e => e.message).join(', '));
}
const customer = Value.Clean(CustomerSchema, filled);
// No typed InstantiationError; manual process; no Transform decoder support
```

```ts [AJV]
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
addFormats(ajv);
const valid = ajv.validate(customerSchema, rawData);
// rawData mutated in place  - no typed return value
if (!valid) throw new Error(ajv.errorsText());
// No TypeScript type narrowing; errors are ajv's ErrorObject[]
```

```py [Pydantic]
from pydantic import BaseModel, ValidationError

class Customer(BaseModel):
    id: str
    email: str
    name: str
    addresses: list[Address] = []

try:
    customer = Customer.model_validate(raw_data)
    # defaults applied; extra fields ignored (extra='ignore' default)
except ValidationError as e:
    print(e.errors())  # structured error list
```

:::

## Related

- [`JsonTology.validate`](/validation/validate) - when you only need the human-readable error strings without a throw
- [`JsonTology.validate`](/validation/validate) - when you need structured `ValidationErrors` without an exception
- [`JsonTology.is`](/validation/is) - when you only need a boolean type guard
- [`JsonTology.materialize`](/registry/materialize) - when you want to build from partial trusted data + defaults without validation throwing
- [`Compose.pick`](/composition/pick-omit) / [`omit`](/composition/pick-omit) - build sub-schemas before passing to `instantiate`

## See also

- [Bookstore domain](/bookstore-domain) - where `Customer`, `Order`, and `OrderLine` are defined
- [Error views](/errors/views) - what to do with the `ValidationErrors` when instantiate throws
- [Transforms](/transforms/decode-encode) - how Transform decoders integrate with `instantiate`

## Per-call options

`instantiate` accepts an optional third argument to override behavior for a single call:

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `enableDefaults` | `boolean` | inherits from `JsonTology.create` | Override default-filling for this call only. |

### Example: validate without filling defaults

Useful for PATCH endpoints where missing fields mean "no change" rather than "use default":

```ts
const patched = jt.instantiate(
  CustomerSchema.$id,
  incomingPatchBody,
  { enableDefaults: false }  // missing fields stay missing
);
```

The registry's global `enableDefaults` setting is unchanged by per-call options.
