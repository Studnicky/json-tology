# Composition

`Compose` provides static methods for deriving new schemas from existing ones. All methods return new schema objects — input schemas are never mutated. The TypeScript types are inferred at compile time; the output is valid JSON Schema at runtime.

## Methods

| Method | Description |
|--------|-------------|
| [`extend`](./extend) | Add properties to a base schema |
| [`pick` / `omit`](./pick-omit) | Keep or remove specific properties |
| [`partial` / `required`](./partial-required) | Make all properties optional or required |
| [`intersection`](./intersection) | Combine schemas with `allOf` |
| [`discriminatedUnion` / `narrow`](./discriminated-union) | `oneOf` with type discriminator |
| [`getDefaults`](./get-defaults) | Extract declared default values |

All examples use the [bookstore domain](/bookstore-domain). Composed schemas build on each other — see [Getting Started](/getting-started) for the basics.
