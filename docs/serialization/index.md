# Serialization

Serialization converts domain objects back to wire form — the outgoing direction complementary to `coerce`.

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| [`dump`](./dump#jt-dump) | `unknown` (wire-form JS value) | Walk schema graph, apply encoders, filter |
| [`dumpJson`](./dump#jt-dumpjson) | `string` | Same as `dump` but returns a JSON string |
| [`toSchema`](./toSchema) | `Record<string, unknown> \| undefined` | Reconstruct JSON Schema from the canonical graph |

All examples use the [bookstore domain](/bookstore-domain). See [`coerce`](/validation/coerce) for the incoming direction.
