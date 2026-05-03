# `JsonTology.validate`

**Declaration.** Validates data against a registered schema and returns an array of human-readable error message strings. Returns an empty array when the data is valid. Does not mutate the input. Does not throw on validation failure.

**Use this when** you want a quick list of error strings for display, logging, or passing to a legacy error reporter — and you don't need structured error objects with path/keyword/params. Use this in CLI tools, developer feedback, or situations where a flat string list is the right output.

**Don't use this when** you need structured access to error paths, keywords, or params (use [`errors`](/validation/errors) instead). Don't use it when you want a boolean check (use [`is`](/validation/is) instead). Don't use it when you want the coerced typed value on success (use [`coerce`](/validation/coerce) instead).

## Examples

### Example 1: Basic valid and invalid cases

```ts
import { jt, CustomerSchema } from './bookstore/schemas.js';

// Valid — empty array
const ok = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});
console.log(ok); // []

// Missing required fields
const bad = jt.validate(CustomerSchema.$id, {
  email: 'alice@bookstore.example',
});
console.log(bad);
// ["root: must have required property 'id'", "root: must have required property 'name'"]
```

### Example 2: Nested schema errors with JSON Pointer paths

`OrderSchema` contains `items: [OrderLine]` via `$ref`. Errors on nested fields include the full JSON Pointer path.

```ts
import { jt, OrderSchema } from './bookstore/schemas.js';

const errors = jt.validate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      -5,      // exclusiveMinimum: 0 violated
  items: [
    { bookIsbn: '9780140449136', quantity: 0, unitPrice: 12.99 }, // minimum: 1 violated
  ],
});
// ["/total: must be > 0", "/items/0/quantity: must be >= 1"]
```

### Example 3: Use as a lightweight form validator

Validate on blur before attempting a full coerce.

```ts
import { jt, ReviewSchema } from './bookstore/schemas.js';

function validateReviewForm(formData: Record<string, unknown>): string[] {
  return jt.validate(ReviewSchema.$id, formData);
}

const fieldErrors = validateReviewForm({ rating: 6, body: 'hi' });
// ["/rating: must be <= 5", "/body: must NOT have fewer than 10 characters"]
if (fieldErrors.length > 0) {
  // display errors in the UI
}
```

## Bad examples — what NOT to do

### Anti-pattern 1: Checking the return length and then re-coercing

```ts
// ⊥ Don't do this — double work, data is validated twice
const errs = jt.validate(CustomerSchema.$id, data);
if (errs.length === 0) {
  const customer = jt.coerce(CustomerSchema.$id, data); // validates again
}

// ✓ Do this — coerce directly; it validates + applies defaults in one pass
try {
  const customer = jt.coerce(CustomerSchema.$id, data);
} catch (err) {
  // handle CoercionError
}
```

### Anti-pattern 2: Parsing the error strings to extract field paths

```ts
// ⊥ Don't do this — parsing formatted strings is fragile
const msg = jt.validate(CustomerSchema.$id, data)[0];
const path = msg.split(':')[0]; // fragile string parsing

// ✓ Do this — use errors() for structured access
const errs = jt.errors(CustomerSchema.$id, data);
for (const err of errs) {
  console.log(err.path, err.keyword, err.message);
}
```

## Comparison

::: code-group

```ts [json-tology]
const errors = jt.validate(CustomerSchema.$id, data);
// string[] — empty if valid
// does not throw, does not coerce
```

```ts [Zod]
const result = CustomerSchema.safeParse(data);
if (!result.success) {
  const messages = result.error.issues.map(i => `${i.path.join('/')}: ${i.message}`);
}
// safeParse doesn't throw; parse() throws ZodError
```

```ts [TypeBox + Value]
import { TypeCompiler } from '@sinclair/typebox/compiler';
const C = TypeCompiler.Compile(CustomerSchema);
const errors = [...C.Errors(data)].map(e => `${e.path}: ${e.message}`);
```

```ts [AJV]
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);
const valid = ajv.validate(customerSchema, data);
const messages = valid ? [] : ajv.errors!.map(e => `${e.instancePath}: ${e.message}`);
```

```py [Pydantic]
from pydantic import ValidationError

try:
    Customer(**data)
    messages = []
except ValidationError as e:
    messages = [f"{'/'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()]
```

:::

## Related

- [`JsonTology.errors`](/validation/errors) — structured `ValidationErrors` with path/keyword/params
- [`JsonTology.is`](/validation/is) — boolean type guard, no strings
- [`JsonTology.coerce`](/validation/coerce) — validate + apply defaults + return typed value
- [`JsonTology.validateAt`](/validation/validateAt) — validate against a sub-schema by JSON Pointer

## See also

- [Error views](/errors/views) — `messages`, `format`, `flatten`, `aggregate`, `report`
- [Bookstore domain](/bookstore-domain) — schema definitions used in examples
