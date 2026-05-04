# Validation

json-tology validates data against registered JSON Schemas via a compiled graph engine. All validation methods accept either a schema `$id` string or a schema object with `$id`.

## Methods

| Method | Returns | Use when |
|--------|---------|----------|
| [`instantiate`](./coerce) | `TMap[K]` (typed) | You want a typed, defaults-applied value or a typed exception |
| [`validate`](./validate) | `string[]` | You want human-readable error strings |
| [`is`](./is) | `boolean` type guard | You need a boolean with TypeScript narrowing |
| [`errors`](./errors) | `ValidationErrors` | You need structured error data (paths, keywords, params) |
| [`subschemaAt`](./subschemaAt) | `string[]` | You need to validate a sub-schema by JSON Pointer |

Error views on `ValidationErrors`: see [Error Views](/errors/views) for `messages`, `format`, `flatten`, `aggregate`, `report`.

All examples use the [bookstore domain](/bookstore-domain). See [Getting Started](/getting-started) for installation.
