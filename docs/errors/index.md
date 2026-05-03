# Error Views

`ValidationErrors` exposes five methods for accessing the same error data in different formats. Obtain the collection from [`jt.errors()`](/validation/errors) or from `CoercionError.errors`.

## Methods

| View | Returns | Best for |
|------|---------|----------|
| [`messages()`](./views#validationerrors-messages) | `string[]` | Console, logs, simple display |
| [`format()`](./views#validationerrors-format) | `Record<string, string[]>` | Form field highlighting |
| [`flatten()`](./views#validationerrors-flatten) | `{ fieldErrors, formErrors }` | Zod-compatible form libraries |
| [`aggregate()`](./views#validationerrors-aggregate) | `{ count, paths, keywords }` | Structured logs, metric labels |
| [`report()`](./views#validationerrors-report) | `ProblemDetailsType` | HTTP 422 response bodies (RFC 7807) |

All examples use the [bookstore domain](/bookstore-domain). See [`jt.errors()`](/validation/errors) for how to obtain the collection.
