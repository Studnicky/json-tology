# Composition

> Validation modes: [Validation modes reference](/validation-modes)

`Compose` provides static methods for deriving new schemas from existing ones. All methods return new schema objects - input schemas are never mutated. The TypeScript types are inferred at compile time; the output is valid JSON Schema at runtime.

## Which one do I want

Several methods look similar because they share the same `allOf`-shaped output or the same "is-a" framing. Pick by what you're actually trying to say:

- **Adding fields to a base schema?** Use [`extend`](./extend). It's the default choice for "I have a base and I want a few more fields."
- **Need multi-parent taxonomy, or want the ontology to read as explicit classification?** Use [`subClassOf`](./sub-class-of) instead of `extend` - same `allOf + $ref` wire shape, but it accepts multiple parents and signals "is-a" rather than "has more fields."
- **Need every constituent schema's `required` constraints enforced simultaneously, with all of them inlined (not just referenced)?** Use [`intersection`](./intersection).
- **Need a semantic alias with identical structure** (a domain-specific name for a shared primitive, no new fields, no new constraints)**?** Use [`equivalent`](./equivalent). If the two schemas differ structurally at all, `equivalent` is the wrong tool - reach for `extend` or a standalone schema instead.

In short: `extend`, `intersection`, and `subClassOf` all produce `allOf`-shaped output, but differ in cardinality (single vs. multi-parent) and in whether the base is referenced or fully inlined. `equivalent`, `subClassOf`, and `extend` are all "is-a"-adjacent, but only `equivalent` requires byte-for-byte structural identity.

## Core composition operations

| Method | Description | Mode |
|--------|-------------|------|
| [`extend`](./extend) | Add properties to a base schema | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`pick` / `omit`](./pick-omit) | Keep or remove specific properties | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`partial` / `required`](./partial-required) | Make all properties optional or required | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`intersection`](./intersection) | Combine schemas with `allOf` | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`discriminatedUnion` / `narrow`](./discriminated-union) | `oneOf` with type discriminator | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`getDefaults`](./get-defaults) | Extract declared default values | <Badge type="tip" text="Runtime" /> |
| [`equivalent`](./equivalent) | Declare two schemas as semantically equivalent | <Badge type="info" text="Compile-time" /> |

## OWL class axioms (opt-in)

| Method | Description | Mode |
|--------|-------------|------|
| [`subClassOf`](./sub-class-of) | OWL subclass axiom | <Badge type="info" text="Compile-time" /> |
| [`disjointWith`](./sub-class-of) | OWL disjoint-class axiom | <Badge type="warning" text="Compile-time + Runtime" /> |
| [`complementOf`](./sub-class-of) | OWL complement axiom | <Badge type="info" text="Compile-time" /> |
| [`restrictions`](./restrictions) | OWL property restrictions | <Badge type="info" text="Compile-time" /> |

All examples use the [bookstore domain](/bookstore-domain). Composed schemas build on each other - see [Getting Started](/getting-started) for the basics.

## Related

- [`set`](/registry/register#registry-set) - register composed schemas before use
- [`instantiate`](/validation/instantiate) - coerce values through composed schemas
- [`materialize`](/registry/materialize) - fill defaults through composed schemas

## See also

- [Bookstore domain](/bookstore-domain) - base schemas used throughout composition examples
- [Argument conventions](/argument-conventions) - how composed schemas work as `SchemaRef`
- [Graph-native authoring](/advanced/graph-native-authoring) - when to extract vs compose
