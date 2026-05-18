# Argument conventions

> Validation modes: [Validation modes reference](/validation-modes)

## Universal SchemaRef

Every method that accepts a schema reference accepts **both** a string ID and a schema object:

<<< ../examples/docs/argument-conventions/02-universal-schema-ref.ts

Resolution rule: if a string, look up in the registry; if an object with `$id`, register it (idempotent) then run against it.

## Static counterparts <Badge type="warning" text="Compile-time + Runtime" />

The static facade methods (`JsonTology.dump`, `JsonTology.fromQuads`, `JsonTology.instantiate`, `JsonTology.materialize`) are generic over the supplied schema and return the inferred type rather than `unknown`. Explicit casts to the schema's inferred type are no longer required.

Every instance method has a static counterpart on `JsonTology` that creates an ephemeral registry, registers the schema, runs the operation, and returns. No shared state. No setup required.

<<< ../examples/docs/argument-conventions/03-static-counterparts.ts

Available static methods:

| Static | Instance equivalent |
|--------|---------------------|
| `JsonTology.is(schema, data)` | `jt.is(schema, data)` |
| `JsonTology.validate(schema, data)` | `jt.validate(schema, data)` |
| `JsonTology.instantiate(schema, data, options?)` | `jt.instantiate(schema, data, options?)` |
| `JsonTology.materialize(schema, data?, options?)` | `jt.materialize(schema, data?, options?)` |
| `JsonTology.subschemaAt(schema, pointer)` | `jt.subschemaAt(schema, pointer)` |
| `JsonTology.dump(schema, value, options?)` | `jt.dump(schema, value, options?)` |
| `JsonTology.dumpJson(schema, value, options?)` | `jt.dumpJson(schema, value, options?)` |
| `JsonTology.toQuads(schema, data)` | `jt.toQuads(schema, data)` |
| `JsonTology.fromQuads(schema, quads)` | `jt.fromQuads(schema, quads)` |
| `JsonTology.toSchema(schema)` | `jt.toSchema(schema)` |
| `JsonTology.toTbox(schemas)` | `jt.toTbox()` |
| `JsonTology.toShacl(schemas)` | `jt.toShacl()` |
| `JsonTology.ontology(schemas)` | `jt.ontology()` |

Static methods create a fresh ephemeral instance per call. Use instance methods when you have multiple schemas
that reference each other, or when you need to register invariants and computeds.

## Argument order rules

- **One source, minting a new ID**: `(source, newId, extras?)` - e.g. `Compose.extend(UserSchema, additions, 'NewId')`
- **Many sources**: `(sources, newId, extras?)` - e.g. `Compose.intersection([A, B] as const, 'NewId')`

## `subschemaAt` - composable pointer resolution

`subschemaAt` resolves a JSON Pointer within a parent schema and returns the sub-schema as
a registerable schema object. The result can be passed directly to any of the four core methods:

<<< ../examples/docs/argument-conventions/04-subschema-at.ts

The returned schema has a synthesized `$id` of the form `<parent.$id>#<pointer>` and is
automatically registered in the calling registry so subsequent operations work directly.

## Related

- [`instantiate`](/validation/instantiate) - primary consumer of `SchemaRef`
- [`validate`](/validation/validate) - also accepts string or object
- [`subschemaAt`](/validation/subschemaAt) - returns a composable sub-schema `SchemaRef`

## See also

- [Picking a method](/picking-a-method) - which method to call given your data source
- [Bookstore domain](/bookstore-domain) - schemas used in examples
