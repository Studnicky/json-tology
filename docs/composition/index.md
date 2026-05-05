# Composition

`Compose` provides static methods for deriving new schemas from existing ones. All methods return new schema objects - input schemas are never mutated. The TypeScript types are inferred at compile time; the output is valid JSON Schema at runtime.

## Methods

| Method | Description |
|--------|-------------|
| [`extend`](./extend) | Add properties to a base schema |
| [`pick` / `omit`](./pick-omit) | Keep or remove specific properties |
| [`partial` / `required`](./partial-required) | Make all properties optional or required |
| [`intersection`](./intersection) | Combine schemas with `allOf` |
| [`equivalent`](/composition/equivalent) | Declare two schemas as semantically equivalent (`equivalentClass` / `equivalentProperty`) |
| [`discriminatedUnion` / `narrow`](./discriminated-union) | `oneOf` with type discriminator |
| [`getDefaults`](./get-defaults) | Extract declared default values |

All examples use the [bookstore domain](/bookstore-domain). Composed schemas build on each other - see [Getting Started](/getting-started) for the basics.

## Related

- [`register`](/registry/register) - register composed schemas before use
- [`instantiate`](/validation/instantiate) - coerce values through composed schemas
- [`materialize`](/registry/materialize) - fill defaults through composed schemas

## See also

- [Bookstore domain](/bookstore-domain) - base schemas used throughout composition examples
- [Argument conventions](/argument-conventions) - how composed schemas work as `SchemaRef`
- [Graph-native authoring](/advanced/graph-native-authoring) - when to extract vs compose
