# `JsonTology.validate` — ValidationErrors

**Declaration.** `validate()` now returns `ValidationErrors` (not `string[]`). See [`validate()`](/validation/validate) for the full reference. This page covers the `ValidationErrors` collection shape and usage patterns.

**Use this when** you need programmatic access to the structured error list — paths, keywords, params — without wanting an exception. This is the right method for API validation where you collect errors, then decide what to do with them (return a 422, log, display in a form). The collection is iterable with `for...of`.

**Don't use this when** you only need a boolean (use [`is`](/validation/is)). Don't use it when you want the coerced typed value on success (use [`instantiate`](/validation/instantiate)).

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
console.log(errs.length);  // ≥ 2

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

### Example 3: Combine with one of the five views

See [`Error views`](/errors/views) for full documentation of each view.

```ts
import { bookstoreEntities as entities, ReviewSchema } from './bookstore/index.js';

const errs = entities.validate(ReviewSchema.$id, badReview);

// Choose the view that matches your output target:
console.log(errs.items.map(e => `${e.path}: ${e.message}`));   // string[] — one per error
console.log(Object.groupBy(errs.items, err => err.path || "_root"));     // Record<string, string[]> — grouped by path
console.log(Object.groupBy(errs.items, err => err.path ? "fieldErrors" : "formErrors"));    // { fieldErrors, formErrors }
console.log(errs.aggregate());  // { count, paths, keywords }
console.log(errs.report());     // RFC 7807 ProblemDetailsType
```

## Bad examples — what NOT to do

### Anti-pattern 1: Calling errors() and then coerce() separately

```ts
// ⊥ Don't do this — double validation; if errors is empty just use coerce
const errs = entities.validate(CustomerSchema.$id, data);
if (errs.ok) {
  const customer = jt.instantiate(CustomerSchema.$id, data); // validates again
}

// ✓ Do this — catch InstantiationError directly
try {
  const customer = jt.instantiate(CustomerSchema.$id, data);
} catch (err) {
  if (err instanceof InstantiationError) {
    const problem = err.errors.report();  // same ValidationErrors on InstantiationError
  }
}
```

### Anti-pattern 2: Accessing .items directly instead of using a view

```ts
// ⊥ Don't do this — accessing raw items and re-implementing a view
const grouped: Record<string, string[]> = {};
for (const item of errs.items) {
  (grouped[item.path] ??= []).push(item.message);
}

// ✓ Do this — use format() which does exactly this
const grouped = Object.groupBy(errs.items, err => err.path || "_root");
```

## Comparison

::: code-group

```ts [json-tology]
const errs = entities.validate(OrderSchema.$id, data);
// ValidationErrors — .ok, .length, iterable, .items.map(e => `${e.path}: ${e.message}`), .format(), .flatten(), .aggregate(), .report()
```

```ts [Zod]
const result = OrderSchema.safeParse(data);
if (!result.success) {
  result.error.issues; // ZodIssue[] — path (array), code, message per issue
  result.error.flatten(); // { fieldErrors, formErrors } — Zod-native flatten
}
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
const errors = [...Value.Errors(OrderSchema, data)];
// ValueError[] — path, message, schema, value per error
// No built-in views (format, flatten, aggregate, report)
```

```ts [AJV]
ajv.validate(orderSchema, data);
const errors = ajv.errors ?? [];
// ErrorObject[] — instancePath, keyword, message, params per error
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

- [`JsonTology.validate`](/validation/validate) — just the string array
- [`JsonTology.is`](/validation/is) — boolean type guard
- [`JsonTology.coerce`](/validation/instantiate) — throws `InstantiationError` which carries the same `ValidationErrors` on `.errors`
- [Error views](/errors/views) — `messages`, `format`, `flatten`, `aggregate`, `report` in full detail

## See also

- [Invariants](/registry/invariants) — cross-field rules that produce `ValidationErrorType` items with `keyword: 'jt:invariant'`
- [Bookstore domain](/bookstore-domain) — schema definitions used in examples
