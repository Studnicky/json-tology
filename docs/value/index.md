# Value Operations

`Value` provides two kinds of operations:

- **Static** — pure functions on any value without a schema: `clone`, `hash`, `diff`, `applyOp`
- **Instance** — schema-aware operations via `jt.value.*`: `cast`, `clean`, `convert`, `create`, `instantiate`

## Methods

| Method | Kind | Description |
|--------|------|-------------|
| [`Value.clone` / `Value.hash`](./clone-hash) | Static | Deep copy; deterministic hash |
| [`Value.diff` / `Value.applyOp`](./diff) | Static | Structural diff; apply a single operation |
| [`value.cast` / `clean` / `convert`](./cast-clean-convert) | Instance | Type coercion, stripping, conversion |
| [`value.create`](./create) | Instance | Zero-value instance for blank form state |

All examples use the [bookstore domain](/bookstore-domain).
