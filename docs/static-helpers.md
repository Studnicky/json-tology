# Static helpers

Every operation that takes a registered schema also has a static counterpart on `JsonTology`. The static form builds a one-shot ephemeral registry containing only the supplied schema, runs the operation, and discards the registry.

> Use static when you do not need to reuse a registry across calls.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used in the example.

## Catalogue

| Static                              | Purpose                                                  | Instance equivalent           |
|-------------------------------------|----------------------------------------------------------|-------------------------------|
| `JsonTology.is(schema, data)`                        | Boolean type guard                                        | `jt.is(id, data)`             |
| `JsonTology.validate(schema, data)`                  | Returns `ValidationErrors`                                | `jt.validate(id, data)`       |
| `JsonTology.instantiate(schema, data, options?)`     | Validates and returns the typed value                     | `jt.instantiate(id, data)`    |
| `JsonTology.materialize(schema, partial?, options?)` | Fills defaults; throws on validation failure              | `jt.materialize(schema, ...)` |
| `JsonTology.subschemaAt(schema, pointer)`            | Resolves a sub-schema by JSON Pointer                     | `jt.subschemaAt(id, pointer)` |
| `JsonTology.dump(schema, value, options?)`           | Serializes to wire form                                   | `jt.dump(id, value)`          |
| `JsonTology.dumpJson(schema, value, options?)`       | Serializes to JSON string                                 | `jt.dumpJson(id, value)`      |
| `JsonTology.toQuads(schema, data)`                   | Projects instance to ABox quads                           | `jt.toQuads(schema, data)`    |
| `JsonTology.fromQuads(schema, quads)`                | Lifts quads back to typed objects                         | `jt.fromQuads(id, quads)`     |
| `JsonTology.toSchema(schema)`                        | Reconstructs JSON Schema from the canonical graph         | `jt.toSchema(id)`             |
| `JsonTology.toTbox(schemas)`                         | Returns OWL TBox builder for the given schemas            | `jt.toTbox()`                 |
| `JsonTology.toShacl(schemas)`                        | Returns SHACL shapes builder for the given schemas        | `jt.toShacl()`                |
| `JsonTology.ontology(schemas)`                       | Returns combined TBox + SHACL builder                     | `jt.ontology()`               |

The single-schema statics accept a schema object (not a string `$id`) because they need the full document to register internally. The multi-schema statics (`toTbox`, `toShacl`, `ontology`) accept a `ReadonlyArray` of schema objects.

## When to pick which

- **Static.** Self-contained schema, one or two operations, no shared state with other schemas.
- **Instance.** Multiple schemas that `$ref` each other, repeated operations on the same schema, registered computed fields or invariants, format plugins, vocabulary plugins, or anything that reuses validation state.

A static call rebuilds the canonical graph for every invocation. An instance reuses the registry's compiled validators, materializer, and graph cache.

## Comparison: instance vs static for `validate`

```ts
// ── Instance form ──────────────────────────────────────────
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

const errs = entities.validate(CustomerSchema.$id, data);
// CustomerSchema is registered once at JsonTology.create() time;
// every call reuses the compiled validator.

// ── Static form ────────────────────────────────────────────
import { JsonTology, CustomerSchema } from './bookstore/index.js';

const errs2 = JsonTology.validate(CustomerSchema, data);
// Builds an ephemeral registry, registers CustomerSchema,
// runs validate, discards the registry. Each call repeats the work.
```

The two forms return the same `ValidationErrors` collection. Pick the static form for one-off scripts, examples, and self-contained schemas; pick the instance form for everything else.

## Related

- [Picking a method](/picking-a-method) - decision guide across the validation surface
- [Argument conventions](/argument-conventions) - schema reference rules shared by both forms
- [`validate`](/validation/validate) and [`instantiate`](/validation/instantiate) - the most common pair
- [`toQuads` / `fromQuads`](/advanced/quads) - RDF round-trip with both static and instance variants

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in the example
