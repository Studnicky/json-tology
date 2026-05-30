# Argument conventions

> Validation modes: [Validation modes reference](/validation-modes)

## The rule

> **Required arguments are positional. Optional values, overrides, and configuration form a single config object as the last parameter.**

This convention applies uniformly to every public and internal callable in the package: instance methods, static facade methods, constructors, and low-level RDF helpers. Once you learn it for `JsonTology`, you know the shape of every other entry point.

### Why

- **DX uniformity.** Every signature reads the same way. You never need to remember which positional was which option.
- **Future-extensible.** Adding a new optional knob means adding a key to the options interface, never another positional, never a breaking change.
- **Single trailing bag.** No "two-options-objects" ambiguity, no boolean flags spread across positions.

### Shapes

**Required-only positionals.** Methods with only required arguments take no trailing options bag.

<!-- inline-ts-ok: call-signature illustration with placeholder arguments; documents argument shape, not a runnable scenario -->
```ts
curie.expand(value);                       // Curie instance method, single required positional
Hash.value(input);                         // single required positional
Path.toAccess(jsonPointer);                // single required positional
```

**Required positionals + options.** The options bag is the final parameter and is always optional.

<!-- inline-ts-ok: call-signature illustration using `options?` pseudo-syntax; documents argument shape, not a runnable scenario -->
```ts
jt.toQuads(schema, data, options?);
QuadFactory.iri(value, options?);                                // { curie? }
QuadFactory.literal(value, datatype, options?);                  // { curie? }
QuadFactory.quad(subject, predicate, object, options?);          // { curie?, graph? }
QuadFactory.emitLiterals(subject, predicate, relations, quads, options?);
QuadFactory.emitConstraintLiteral(subject, predicate, datatype, relations, quads, options?);
```

**Constructors.** Same rule: required positionals first, options bag last.

<!-- inline-ts-ok: constructor-signature illustration using `options?` pseudo-syntax; documents argument shape, not a runnable scenario -->
```ts
new IdentifierIssuer(options?);                    // { prefix?, counter?, existingMap? }
new SchemaError(code, message, options?);          // { schemaId?, cause? }
new GraphError(code, message, options?);           // { pointer?, cause? }
new BaseError(code, message, options?);            // { retryable?, cause? }
```

### v0.15.0 surface alignment

v0.15.0 brings the entire public surface into compliance with this rule. The notable changes:

- **`QuadFactory`**: `iri`, `literal`, `quad`, `emitLiterals`, and `emitConstraintLiteral` previously accepted a trailing `curie` positional. They now accept an options bag (`{ curie }`, plus `{ curie, graph }` for `quad`).
- **`BaseError` / `SchemaError` / `GraphError`**: `retryable`, `schemaId`, and `pointer` moved from positional arguments into the constructor options bag (alongside `cause`).
- **`IdentifierIssuer`**: new utility; its constructor takes a single optional options bag (`{ prefix?, counter?, existingMap? }`).

All call sites in the package have been updated. External callers using positional forms must migrate to the options-bag form.

### Option interface names

Each options bag has a canonical interface declared in `src/interfaces/`. They are exported through `json-tology/interfaces` (type-only) so external callers can reference the exact shape they pass.

| Bag | Interface | Source |
|-----|-----------|--------|
| `QuadFactory.iri` options | `QuadFactoryIriOptsInterface` | `src/interfaces/QuadFactoryOpts.ts` |
| `QuadFactory.literal` options | `QuadFactoryLiteralOptsInterface` | `src/interfaces/QuadFactoryOpts.ts` |
| `QuadFactory.quad` options | `QuadFactoryQuadOptsInterface` | `src/interfaces/QuadFactoryOpts.ts` |
| `QuadFactory.emitLiterals` / `emitConstraintLiteral` options | `QuadFactoryEmitOptsInterface` | `src/interfaces/QuadFactoryOpts.ts` |
| `IdentifierIssuer` constructor options | `IdentifierIssuerOptsInterface` | `src/interfaces/IdentifierIssuerOpts.ts` |
| `BaseError` constructor options | `BaseErrorOptionsType` | `src/types/ErrorOptions.ts` |
| `SchemaError` constructor options | `SchemaErrorOptionsType` | `src/types/ErrorOptions.ts` |
| `GraphError` constructor options | `GraphErrorOptionsType` | `src/types/ErrorOptions.ts` |

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

## Compose argument order

The `Compose.*` helpers mint new schemas from existing ones. All positional arguments are required; there is no optional trailing options bag.

- **One source, minting a new ID**: `(source, <required middle arg>, newId)`, where the middle argument is the operation-specific required input (e.g. `additionalProperties` for `extend`, `keys` for `pick`/`omit`). Example: `Compose.extend(UserSchema, additions, 'NewId')`
- **Many sources**: `(sources, newId)`, exactly two arguments, no extras. Example: `Compose.intersection([A, B] as const, 'NewId')`

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
