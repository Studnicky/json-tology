# Serialization

Serialization converts domain objects back to wire form - the outgoing direction complementary to `instantiate`.

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| [`dump`](./dump#jt-dump) | `unknown` (wire-form JS value) | Walk schema graph, apply encoders, filter |
| [`dumpJson`](./dump#jt-dumpjson) | `string` | Same as `dump` but returns a JSON string |
| [`toSchema`](./toSchema) | `Record<string, unknown> \| undefined` | Reconstruct JSON Schema from the canonical graph |

All examples use the [bookstore domain](/bookstore-domain). See [`instantiate`](/validation/instantiate) for the incoming direction.

## Related

- [`instantiate`](/validation/instantiate) - the incoming direction (wire to domain)
- [`Transform.create`](/transforms/decode-encode) - register encode/decode pairs used by `dump`
- [`jt.encode`](/transforms/decode-encode#jtencode) - single-schema encode

## See also

- [Bookstore domain](/bookstore-domain) - schemas used throughout serialization examples
- [Transforms](/transforms/decode-encode) - how Transform encoders apply during `dump`
