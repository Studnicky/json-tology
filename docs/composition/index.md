# Composition

> Validation modes: [Validation modes reference](/validation-modes)

`Compose` provides static methods for deriving new schemas from existing ones. All methods return new schema objects - input schemas are never mutated. The TypeScript types are inferred at compile time; the output is valid JSON Schema at runtime.

## Methods

| Method | Description | Mode |
|--------|-------------|------|
| [`extend`](./extend) | Add properties to a base schema | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`pick` / `omit`](./pick-omit) | Keep or remove specific properties | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`partial` / `required`](./partial-required) | Make all properties optional or required | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`intersection`](./intersection) | Combine schemas with `allOf` | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`equivalent`](/composition/equivalent) | Declare two schemas as semantically equivalent | <Badge type="info" text="Compile-time" /> |
| [`discriminatedUnion` / `narrow`](./discriminated-union) | `oneOf` with type discriminator | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`getDefaults`](./get-defaults) | Extract declared default values | <Badge type="info" text="Compile-time" /> |
| [`subClassOf` / `disjointWith` / `complementOf`](./sub-class-of) | OWL class axioms | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`restrictions`](./restrictions) | OWL property restrictions | <Badge type="info" text="Compile-time" /> |

All examples use the [bookstore domain](/bookstore-domain). Composed schemas build on each other - see [Getting Started](/getting-started) for the basics.

## Related

- [`register`](/registry/register) - register composed schemas before use
- [`instantiate`](/validation/instantiate) - coerce values through composed schemas
- [`materialize`](/registry/materialize) - fill defaults through composed schemas

## See also

- [Bookstore domain](/bookstore-domain) - base schemas used throughout composition examples
- [Argument conventions](/argument-conventions) - how composed schemas work as `SchemaRef`
- [Graph-native authoring](/advanced/graph-native-authoring) - when to extract vs compose
