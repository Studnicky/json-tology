# `ValidationErrors`

**Declaration.** `validate()` returns `ValidationErrors` (not `string[]`). See [`validate()`](/validation/validate) for the method reference. This page covers the `ValidationErrors` collection shape and usage patterns.

The `ValidationErrors` collection is also carried on `InstantiationError.errors` and `CoercionError.errors`, so the same patterns apply when you catch those exceptions.

**Use this when** you need programmatic access to the structured error list - paths, keywords, params - without wanting an exception. This is the right collection for API validation where you collect errors, then decide what to do with them (return a 422, log, display in a form). The collection is iterable with `for...of`.

**Don't use this when** you only need a boolean (use [`is`](/validation/is)). Don't use it when you want the coerced typed value on success (use [`instantiate`](/validation/instantiate)).

## Public surface

| Member | Type | Purpose |
|--------|------|---------|
| `items` | `readonly ValidationErrorType[]` | Raw error list with JSON Pointer paths |
| `length` | `number` | Number of errors |
| `ok` | `boolean` | `true` when `length === 0` |
| `aggregate()` | `AggregateViewType` | `{ count, paths, keywords }` rollup for logs and metrics |
| `report(overrides?)` | `ProblemDetailsType` | RFC 7807 Problem Details payload |
| `[Symbol.iterator]()` | `Iterator<ValidationErrorType>` | Enables `for...of` |

Each `ValidationErrorType` carries:

```ts
type ValidationErrorType = {
  path:    string;                 // JSON Pointer path
  keyword: string;                 // e.g. 'required', 'type', 'jt:invariant'
  message: string;                 // human-readable
  params:  Record<string, unknown> // keyword-specific params
};
```

## Examples

### Example 1: Check validity, iterate errors

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';

const errs = entities.validate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      -5,
  items:      [],       // minItems: 1 violated
});

console.log(errs.ok);      // false
console.log(errs.length);  // >= 2

for (const err of errs) {
  console.log(err.path);    // '/total', '/items'
  console.log(err.keyword); // 'exclusiveMinimum', 'minItems'
  console.log(err.message); // human-readable
  console.log(err.params);  // { limit: 0 }, { limit: 1 }
}
```

### Example 2: Valid data returns empty collection

```ts
import { bookstoreEntities as entities, BookSchema } from './bookstore/index.js';

const errs = entities.validate(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
console.log(errs.ok);     // true
console.log(errs.length); // 0
```

### Example 3: Combine with the structured views

See [`Error views`](/errors/views) for full documentation of each view.

```ts
import { bookstoreEntities as entities, ReviewSchema } from './bookstore/index.js';

const errs = entities.validate(ReviewSchema.$id, badReview);

// Choose the shape that matches your output target:
console.log(errs.items.map(e => `${e.path}: ${e.message}`));   // string[]  - one per error
console.log(Object.groupBy(errs.items, err => err.path || "_root"));     // Record<string, ...>  - grouped by path
console.log(Object.groupBy(errs.items, err => err.path ? "fieldErrors" : "formErrors"));    // { fieldErrors, formErrors }
console.log(errs.aggregate());  // { count, paths, keywords }
console.log(errs.report());     // RFC 7807 ProblemDetailsType
```

## Bad examples - what NOT to do

### Anti-pattern 1: Calling validate() and then instantiate() separately

```ts
// ⊥ Don't do this  - double validation; if errors is empty just call instantiate
const errs = entities.validate(CustomerSchema.$id, data);
if (errs.ok) {
  const customer = jt.instantiate(CustomerSchema.$id, data); // validates again
}

// ✓ Do this  - catch InstantiationError directly
try {
  const customer = jt.instantiate(CustomerSchema.$id, data);
} catch (err) {
  if (err instanceof InstantiationError) {
    const problem = err.errors.report();  // same ValidationErrors collection on InstantiationError
  }
}
```

### Anti-pattern 2: Re-implementing a built-in view

```ts
// ⊥ Don't do this  - rolling your own grouping when Object.groupBy + items does it
const grouped: Record<string, string[]> = {};
for (const item of errs.items) {
  (grouped[item.path] ??= []).push(item.message);
}

// ✓ Do this  - use Object.groupBy on .items, or call .aggregate() / .report()
const grouped = Object.groupBy(errs.items, err => err.path || "_root");
```

## Comparison

::: code-group

```ts [json-tology]
const errs = entities.validate(OrderSchema.$id, data);
// ValidationErrors  - .ok, .length, iterable, .items, .aggregate(), .report()
```

```ts [Zod]
const result = OrderSchema.safeParse(data);
if (!result.success) {
  result.error.issues; // ZodIssue[]  - path (array), code, message per issue
  result.error.flatten(); // { fieldErrors, formErrors }  - Zod-native flatten
}
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
const errors = [...Value.Errors(OrderSchema, data)];
// ValueError[]  - path, message, schema, value per error
// No built-in views
```

```ts [AJV]
ajv.validate(orderSchema, data);
const errors = ajv.errors ?? [];
// ErrorObject[]  - instancePath, keyword, message, params per error
// No built-in views
```

```py [Pydantic]
try:
    Order(**data)
except ValidationError as e:
    e.errors()          # list of dicts: loc, msg, type
    e.error_count()     # int
    e.json()            # JSON string of errors
    # No aggregate() or report() equivalent built in
```

:::

## Related

- [`JsonTology.validate`](/validation/validate) - method that returns `ValidationErrors`
- [`JsonTology.is`](/validation/is) - boolean type guard
- [`JsonTology.instantiate`](/validation/instantiate) - throws `InstantiationError` which carries the same `ValidationErrors` on `.errors`
- [Error views](/errors/views) - `aggregate`, `report` in full detail

## See also

- [Invariants](/registry/invariants) - cross-field rules that produce `ValidationErrorType` items with `keyword: 'jt:invariant'`
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
