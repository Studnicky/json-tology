# Transforms

`Transform` attaches decode/encode functions to schemas without mutating them (stored in a WeakMap). After a transform is registered, `coerce()` automatically applies the decoder after validation.

## Methods

| Method | Description |
|--------|-------------|
| [`Transform.create` / `jt.encode`](./decode-encode) | Attach decode/encode pair; encode domain → wire |
| [`Transform.brand`](./brand) | Compile-time nominal brand (no runtime effect) |
| [`Transform.pipe`](./pipe) | Compose multiple transformation steps |

All examples use the [bookstore domain](/bookstore-domain).
