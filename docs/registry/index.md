# Registry

Schema registration and entity management.

## Methods

| Method | Description |
|--------|-------------|
| [`set` / `registerAnonymous` / registry access](./register) | Schema lifecycle |
| [`materialize`](./materialize) | Build instance from partial + defaults |
| [`addInvariant` / `removeInvariant`](./invariants) | Cross-field validation rules |
| [`addComputed` / `removeComputed`](./computed) | Derived field computation |

All examples use the [bookstore domain](/bookstore-domain).

## Related

- [`instantiate`](/validation/instantiate) - consume registered schemas
- [`materialize`](/registry/materialize) - build instances from registered schemas
- [`Compose` methods](/composition/extend) - derive new schemas to register

## See also

- [Bookstore domain](/bookstore-domain) - registering the six entity schemas
- [Getting started](/getting-started) - `JsonTology.create({ schemas })` for upfront registration
- [Argument conventions](/argument-conventions) - how registered schemas resolve via `SchemaRef`
