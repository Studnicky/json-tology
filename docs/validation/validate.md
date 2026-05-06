# `JsonTology.validate`

**Declaration.** Validates data against a registered schema and returns a `ValidationErrors` collection. The collection is empty (`.ok === true`) when the data is valid. Does not mutate the input. Does not throw on validation failure.

Equivalent to `materialize(idOrSchema, data, { enableValidation: true, enableThrow: false, enableDefaults: false }).errors`.

**Use this when** you need programmatic access to the structured error list - paths, keywords, params - without wanting an exception. This is the right method for API validation where you collect errors, then decide what to do with them (return a 422, log, display in a form). The collection is iterable with `for...of`.

**Don't use this when** you only need a boolean (use [`is`](/validation/is)). Don't use it when you want the coerced typed value on success (use [`instantiate`](/validation/instantiate)).

## Examples

### Example 1: Basic valid and invalid cases

```ts
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

// Valid  - empty collection
const ok = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});
console.log(ok.ok);     // true
console.log(ok.length); // 0

// Missing required fields
const bad = jt.validate(CustomerSchema.$id, {
  email: 'alice@bookstore.example',
});
console.log(bad.length); // 2
for (const err of bad) {
  console.log(err.path, err.keyword, err.message);
}
// '' 'required' "must have required property 'id'"
// '' 'required' "must have required property 'name'"
```

### Example 2: Nested schema errors with JSON Pointer paths

`OrderSchema` contains `items: [OrderLine]` via `$ref`. Errors on nested fields include the full JSON Pointer path.

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';

const errs = jt.validate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      -5,      // exclusiveMinimum: 0 violated
  items: [
    { bookIsbn: '9780140449136', quantity: 0, unitPrice: 12.99 }, // minimum: 1 violated
  ],
});
console.log(errs.items.map(e => `${e.path}: ${e.message}`));
// ["/total: must be > 0", "/items/0/quantity: must be >= 1"]
```

### Example 3: Use as a lightweight form validator

Validate on blur before attempting a full instantiate.

```ts
import type { ValidationErrors } from 'json-tology/types';
import { bookstoreEntities as entities, ReviewSchema } from './bookstore/index.js';

function validateReviewForm(formData: Record<string, unknown>): ValidationErrors {
  return jt.validate(ReviewSchema.$id, formData);
}

const fieldErrors = validateReviewForm({ rating: 6, body: 'hi' });
// items: [{ path: '/rating', ... }, { path: '/body', ... }]
if (fieldErrors.length > 0) {
  // display errors in the UI
}
```

## Bad examples - what NOT to do

### Anti-pattern 1: Checking the return length and then re-instantiating

```ts
// ⊥ Don't do this  - double work, data is validated twice
const errs = jt.validate(CustomerSchema.$id, data);
if (errs.length === 0) {
  const customer = jt.instantiate(CustomerSchema.$id, data); // validates again
}

// ✓ Do this  - instantiate directly; it validates + applies defaults in one pass
try {
  const customer = jt.instantiate(CustomerSchema.$id, data);
} catch (err) {
  // handle InstantiationError
}
```

### Anti-pattern 2: Re-parsing message strings to extract field paths

```ts
// ⊥ Don't do this  - parsing formatted strings is fragile
const errs = jt.validate(CustomerSchema.$id, data);
const msg  = errs.items[0]?.message ?? '';
const path = msg.split(':')[0]; // fragile string parsing

// ✓ Do this  - iterate the structured ValidationErrorType objects
const structured = jt.validate(CustomerSchema.$id, data);
for (const err of structured) {
  console.log(err.path, err.keyword, err.message);
}
```

## Comparison

::: code-group

```ts [json-tology]
const errs = jt.validate(CustomerSchema.$id, data);
// ValidationErrors  - .ok, .length, iterable, .items, .aggregate(), .report()
// does not throw, does not coerce
```

```ts [Zod]
const result = CustomerSchema.safeParse(data);
if (!result.success) {
  const messages = result.error.issues.map(i => `${i.path.join('/')}: ${i.message}`);
}
// safeParse doesn't throw; parse() throws ZodError
```

```ts [Valibot]
import * as v from 'valibot';
const result = v.safeParse(CustomerSchema, data);
if (!result.success) {
  const messages = result.issues.map(i =>
    `${i.path?.map(p => p.key).join('/') ?? ''}: ${i.message}`,
  );
}
// { success, output, issues } - parallels ValidationErrors but no .aggregate/.report views.
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

- [`JsonTology.is`](/validation/is) - boolean type guard, no error data
- [`JsonTology.instantiate`](/validation/instantiate) - validate + apply defaults + return typed value
- [`JsonTology.subschemaAt`](/validation/subschemaAt) - validate against a sub-schema by JSON Pointer
- [`ValidationErrors`](/validation/errors) - the structured collection shape returned by `validate`

## See also

- [Error views](/errors/views) - `aggregate`, `report`, iteration over `ValidationErrors`
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
