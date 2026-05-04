# `JsonTology.coerce`

**Declaration.** Validates input data against a registered schema, applies `default` values declared on schema properties, runs any registered `Transform` decoders, strips unknown properties, and returns a fully typed result. Throws `CoercionError` on validation failure. The input is deep-cloned before mutation — the original is never modified.

**Use this when** you have an unknown-shape input (a request body, a queue message, a config blob, a database row) and you want a typed, validated, defaults-applied domain object — or a typed exception. This is the right method 80% of the time when data enters your application boundary. Prefer this over calling `validate` and then mapping fields manually.

**Don't use this when** you need just a yes/no answer without a throw (use [`is`](/validation/is) instead). Don't use it when you want the structured error list without the exception (use [`errors`](/validation/errors) instead). Don't call `coerce` on already-coerced values — the result of `coerce` is already clean and typed. Don't use `coerce` inside a tight inner loop over millions of calls with a fixed schema — pull `jt.registry.validator(schemaId)` once and reuse the compiled validator.

## Examples

### Example 1: Validate and apply defaults

Valid input: unknown properties are stripped, defaults are filled, the return type is `Customer`.

```ts
import { bookstoreJt, CustomerSchema } from './bookstore/index.js';

const customer = jt.coerce(CustomerSchema.$id, {
  id:            'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email:         'alice@bookstore.example',
  name:          'Alice Chen',
  internalNotes: 'vip',   // ← stripped — not in schema
  // addresses omitted — default [] applied
});
// customer is typed as Customer
// customer.addresses === []
// customer.internalNotes → compile error: property doesn't exist on Customer
```

### Example 2: Coerce as part of a request handler

Catch `CoercionError` and convert to an RFC 7807 Problem Details response (built on [`errors.report`](/errors/views#validationerrors-report)).

```ts
import { CoercionError } from 'json-tology';
import { bookstoreJt, CustomerSchema } from './bookstore/index.js';

function createCustomer(body: unknown) {
  try {
    return jt.coerce(CustomerSchema.$id, body);
  } catch (err) {
    if (err instanceof CoercionError) {
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
import { bookstoreJt, OrderSchema } from './bookstore/index.js';

const order = jt.coerce(OrderSchema.$id, {
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

## Bad examples — what NOT to do

### Anti-pattern 1: Catching CoercionError silently

```ts
// ⊥ Don't do this — you lose the structured ValidationErrors
try {
  jt.coerce(CustomerSchema.$id, data);
} catch {
  /* swallowed */
}

// ✓ Do this — surface the error list
const errs = jt.errors(CustomerSchema.$id, data);
if (!errs.ok) {
  console.log(errs.messages());
}
```

### Anti-pattern 2: Coercing already-coerced values

```ts
// ⊥ Don't do this — wasted work; coerce already returned a typed, clean value
const validated = jt.coerce(CustomerSchema.$id, body);
const again     = jt.coerce(CustomerSchema.$id, validated);

// ✓ Just use the first result
const customer = jt.coerce(CustomerSchema.$id, body);
```

### Anti-pattern 3: Building partial shapes by hand instead of using derived schemas

```ts
import { Compose } from 'json-tology';

// ⊥ Don't do this — build a sub-schema with Compose instead
const partial = { name: body.name, email: body.email };
jt.coerce(CustomerSchema.$id, partial);

// ✓ Do this — pick the sub-schema, coerce cleanly
const SignupSchema = Compose.pick(
  CustomerSchema,
  ['name', 'email'] as const,
  'https://bookstore.example/Signup',
);
jt.coerce(SignupSchema.$id, body);
```

## Comparison

::: code-group

```ts [json-tology]
import { CoercionError } from 'json-tology';

const customer = jt.coerce(CustomerSchema.$id, rawData);
// throws CoercionError on failure
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
// No typed CoercionError; manual process; no Transform decoder support
```

```ts [AJV]
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
addFormats(ajv);
const valid = ajv.validate(customerSchema, rawData);
// rawData mutated in place — no typed return value
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

- [`JsonTology.validate`](/validation/validate) — when you only need the human-readable error strings without a throw
- [`JsonTology.errors`](/validation/errors) — when you need structured `ValidationErrors` without an exception
- [`JsonTology.is`](/validation/is) — when you only need a boolean type guard
- [`JsonTology.materialize`](/registry/materialize) — when you want to build from partial trusted data + defaults without validation throwing
- [`Compose.pick`](/composition/pick-omit) / [`omit`](/composition/pick-omit) — build sub-schemas before passing to `coerce`

## See also

- [Bookstore domain](/bookstore-domain) — where `Customer`, `Order`, and `OrderLine` are defined
- [Error views](/errors/views) — what to do with the `ValidationErrors` when coerce throws
- [Transforms](/transforms/decode-encode) — how Transform decoders integrate with `coerce`

## Per-call options

`coerce` accepts an optional third argument to override behavior for a single call:

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `enableDefaults` | `boolean` | inherits from `JsonTology.create` | Override default-filling for this call only. |

### Example: validate without filling defaults

Useful for PATCH endpoints where missing fields mean "no change" rather than "use default":

```ts
const patched = jt.coerce(
  CustomerSchema.$id,
  incomingPatchBody,
  { enableDefaults: false }  // missing fields stay missing
);
```

The registry's global `enableDefaults` setting is unchanged by per-call options.
