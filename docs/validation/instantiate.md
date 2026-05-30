# `JsonTology.instantiate` <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

**Trust boundary.** Use `instantiate` when data crosses into your system from outside - HTTP request bodies, queue messages, file imports, IPC payloads. Failure means the caller sent invalid data; `InstantiationError` carries the full structured error list for your error response.

**Declaration.** Validates input data against a registered schema, applies `default` values declared on schema properties, runs any registered `Transform` decoders, strips unknown properties, and returns a fully typed result. Throws `InstantiationError` on validation failure. The input is deep-cloned before mutation - the original is never modified.

**Use this when** you have an unknown-shape input (a request body, a queue message, a config blob, a database row) and you want a typed, validated, defaults-applied domain object - or a typed exception. This is the right method 80% of the time when data enters your application boundary. Prefer this over calling `validate` and then mapping fields manually.

**Don't use this when** you need just a yes/no answer without a throw (use [`is`](/validation/is) instead). Don't use it when you want the structured error list without the exception (use [`validate`](/validation/validate) instead). Don't call `instantiate` on already-coerced values - the result of `instantiate` is already clean and typed. Don't use `instantiate` inside a tight inner loop over millions of calls with a fixed schema - pull `jt.registry.validator(schemaId)` once and reuse the compiled validator.

## Examples

### Example 1: Validate and apply defaults

Valid input: unknown properties are stripped, defaults are filled, the return type is `Customer`.

<RunnableExample src="examples/docs/validation/01-instantiate-basic" />

### Example 2: Coerce as part of a request handler

Catch `InstantiationError` and convert to an RFC 7807 Problem Details response (built on [`errors.report`](/errors/views#validationerrors-report)).

<RunnableExample src="examples/docs/validation/22-instantiate-request-handler" />

### Example 3: Coerce a nested schema with $ref

`OrderSchema` contains `items: [OrderLine]` via `$ref`. Each `OrderLine` is coerced independently. See the [bookstore domain](/bookstore-domain) for schema definitions.

<RunnableExample src="examples/docs/validation/23-instantiate-nested-ref" />

## Bad examples - what NOT to do

### Anti-pattern 1: Catching InstantiationError silently

<RunnableExample src="examples/docs/validation/24-instantiate-antipattern-swallow" />

### Anti-pattern 2: Coercing already-coerced values

<RunnableExample src="examples/docs/validation/25-instantiate-antipattern-double-coerce" />

### Anti-pattern 3: Building partial shapes by hand instead of using derived schemas

<RunnableExample src="examples/docs/validation/26-instantiate-antipattern-manual-partial" />

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

## Related

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

<RunnableExample src="examples/docs/validation/27-instantiate-no-defaults-patch" />

The registry's global `enableDefaults` setting is unchanged by per-call options.
