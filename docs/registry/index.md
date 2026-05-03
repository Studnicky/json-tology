# Registry

Schema registration and entity management.

## Methods

| Method | Description |
|--------|-------------|
| [`register` / `registerAnonymous` / `has` / `get` / `list`](./register) | Schema lifecycle |
| [`materialize`](./materialize) | Build instance from partial + defaults |
| [`addInvariant` / `removeInvariant`](./invariants) | Cross-field validation rules |
| [`addComputed` / `removeComputed`](./computed) | Derived field computation |

All examples use the [bookstore domain](/bookstore-domain).
