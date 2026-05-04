# ValidationErrors

`ValidationErrors` is the collection returned by [`entities.validate()`](/validation/validate). Obtain it from `validate()` or from `InstantiationError.errors`.

## API

| Surface | Returns | Best for |
|---------|---------|----------|
| `.items` | `readonly ValidationErrorType[]` | Direct access to raw error objects |
| `.ok` | `boolean` | Quick valid/invalid check |
| `.length` | `number` | Error count |
| `[Symbol.iterator]` | `Iterator<ValidationErrorType>` | `for...of` iteration |
| [`aggregate()`](./views#validationerrors-aggregate) | `{ count, paths, keywords }` | Structured logs, metric labels |
| [`report()`](./views#validationerrors-report) | `ProblemDetailsType` | HTTP 422 response bodies (RFC 7807) |

## Cookbook recipes

These patterns replace the removed `messages()`, `format()`, and `flatten()` methods:

```ts
// was messages()
errs.items.map(err => `${err.path}: ${err.message}`)

// was format() — group by path
const grouped: Record<string, ValidationErrorType[]> = {};
for (const err of errs) {
  (grouped[err.path || '_root'] ??= []).push(err);
}

// was flatten() — field vs form errors
const fieldErrors: ValidationErrorType[] = [];
const formErrors: ValidationErrorType[] = [];
for (const err of errs) {
  if (err.path) { fieldErrors.push(err); } else { formErrors.push(err); }
}
```

All examples use the [bookstore domain](/bookstore-domain). See [`entities.validate()`](/validation/validate) for how to obtain the collection.
