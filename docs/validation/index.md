# Validation

json-tology validates data against registered JSON Schemas via a compiled graph engine. All validation methods accept either a schema `$id` string or a schema object with `$id`.

## Methods

| Method | Returns | Use when |
|--------|---------|----------|
| [`instantiate`](./instantiate) | `TMap[K]` (typed) | You want a typed, defaults-applied value or a typed exception |
| [`validate`](./validate) | `ValidationErrors` | You want structured error data (paths, keywords, params) |
| [`is`](./is) | `boolean` type guard | You need a boolean with TypeScript narrowing |
| [`subschemaAt`](./subschemaAt) | sub-schema object | You need to validate a sub-schema by JSON Pointer |

Error views on `ValidationErrors`: see [Error Views](/errors/views) for `aggregate`, `report`, and iteration.

All examples use the [bookstore domain](/bookstore-domain). See [Getting Started](/getting-started) for installation.
