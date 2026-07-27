# ValidationErrors

`ValidationErrors` is the collection returned by [`entities.validate()`](/validation/validate). Obtain it from `validate()` or from `InstantiationError.errors`.

## API

| Surface | Returns | Best for |
|---------|---------|----------|
| `.items` | `readonly ValidationErrorEntity.Type[]` | Direct access to raw error objects |
| `.ok` | `boolean` | Quick valid/invalid check |
| `.length` | `number` | Error count |
| `[Symbol.iterator]` | `Iterator<ValidationErrorEntity.Type>` | `for...of` iteration |
| [`aggregate()`](./views#validationerrors-aggregate) | `{ count, paths, keywords }` | Structured logs, metric labels |
| [`report()`](./views#validationerrors-report) | `ProblemDetailsEntity.Type` | HTTP 422 response bodies (RFC 7807) |

## Usage examples

Common projections from `errs.items`:

<RunnableExample src="examples/docs/errors/23-projection-recipes" />

All examples use the [bookstore domain](/bookstore-domain). See [`entities.validate()`](/validation/validate) for how to obtain the collection.

## Related

- [`validate`](/validation/validate) - returns the `ValidationErrors` collection
- [`instantiate`](/validation/instantiate) - `InstantiationError.errors` carries the same collection
- [`ValidationErrors` views](/errors/views) - `aggregate`, `report`
- [Error class hierarchy](/errors/classes) - `BaseError`, `InstantiationError`, `CoercionError`, `TransformError`, `DecodeError`, `EncodeError`, `SchemaError`, `GraphError`, `MaterializationError`

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
- [Picking a method](/picking-a-method) - when to use `validate` vs `instantiate` vs `is`
