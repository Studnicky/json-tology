# Value Operations

`Value` provides two kinds of operations:

- **Static** - pure functions on any value without a schema: `Operations.clone`, `Hash.value`, `Value.diff`, `Operations.patch`
- **Instance** - schema-aware operations via `jt.value.*`: `cast`, `clean`, `convert`, `create`, `instantiate`

## Methods

| Method | Kind | Description |
|--------|------|-------------|
| [`Operations.clone` / `Hash.value`](./clone-hash) | Static | Deep copy; deterministic hash |
| [`Value.diff` / `Operations.patch`](./diff) | Static | Structural diff; apply a single operation |
| [`value.cast` / `clean` / `convert`](./cast-clean-convert) | Instance | Type coercion, stripping, conversion |
| [`value.create`](./create) | Instance | Zero-value instance for blank form state |

All examples use the [bookstore domain](/bookstore-domain).

## Related

- [`instantiate`](/validation/instantiate) - produce a typed value before diffing or cloning
- [`materialize`](/registry/materialize) - alternative to `value.create` for defaults-only instances
- [`Compose.getDefaults`](/composition/get-defaults) - extract declared defaults without zero-values

## See also

- [Bookstore domain](/bookstore-domain) - schemas and values used in examples
- [Argument conventions](/argument-conventions) - how `jt.value.*` instance methods relate to the registry
