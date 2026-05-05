# Transforms

`Transform` attaches decode/encode functions to schemas without mutating them (stored in a WeakMap). After a transform is registered, `instantiate()` automatically applies the decoder after validation.

## Methods

| Method | Description |
|--------|-------------|
| [`Transform.create` / `jt.encode`](./decode-encode) | Attach decode/encode pair; encode domain → wire |
| [`Transform.brand`](./brand) | Compile-time nominal brand (no runtime effect) |
| [`Transform.pipe`](./pipe) | Compose multiple transformation steps |

All examples use the [bookstore domain](/bookstore-domain).

## Related

- [`instantiate`](/validation/instantiate) - applies `decode` during instantiation
- [`dump`](/serialization/dump) - applies `encode` during serialization
- [`jt.encode`](/transforms/decode-encode#jtencode) - single-schema encode step
- [`Constraint brands`](/constraint-brands) - automatic brands from JSON Schema keywords

## See also

- [Bookstore domain](/bookstore-domain) - schemas used throughout transform examples
- [Picking a method](/picking-a-method) - when transforms are applied vs when to apply manually
