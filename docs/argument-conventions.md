# Argument conventions

## Universal SchemaRef

Every method that accepts a schema reference accepts **both** a string ID and a schema object:

```ts
import type { SchemaRefType } from 'json-tology/types';

// String ID — looks up in registry
entities.instantiate(UserSchema.$id, data);

// Schema object — registers on first use, then runs
entities.instantiate(UserSchema, data);

// Same for validate, is, materialize, subschemaAt, dump, dumpJson, fromQuads, toSchema
entities.validate(UserSchema.$id, data);
entities.validate(UserSchema, data);
```

Resolution rule: if a string, look up in the registry; if an object with `$id`, register it (idempotent) then run against it.

## Static counterparts

Every instance method has a static counterpart on `JsonTology` that creates an ephemeral registry, registers the schema, runs the operation, and returns. No shared state. No setup required.

```ts
import { JsonTology } from 'json-tology';

// One-shot instantiate — no setup
const user = JsonTology.instantiate(UserSchema, rawData);

// One-shot validate
const errors = JsonTology.validate(UserSchema, rawData);

// One-shot materialize
const fixture = JsonTology.materialize(UserSchema, { id: 'u1' });

// One-shot subschema
const nameSub = JsonTology.subschemaAt(UserSchema, '/properties/name');

// Ontology from multiple schemas
const tbox = JsonTology.toTbox([UserSchema, OrderSchema]);
const shacl = JsonTology.toShacl([UserSchema, OrderSchema]);
const ont = JsonTology.ontology([UserSchema, OrderSchema]);
```

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

- **One source, minting a new ID**: `(source, newId, extras?)` — e.g. `Compose.extend(UserSchema, additions, 'NewId')`
- **Many sources**: `(newId, sources, extras?)` — e.g. `Compose.intersection([A, B] as const, 'NewId')`

## `subschemaAt` — composable pointer resolution

`subschemaAt` resolves a JSON Pointer within a parent schema and returns the sub-schema as
a registerable schema object. The result can be passed directly to any of the four core methods:

```ts
const itemSchema = entities.subschemaAt(OrderSchema.$id, '/properties/items/items');

entities.validate(itemSchema, orderLineData);
entities.is(itemSchema, orderLineData);
entities.instantiate(itemSchema, orderLineData);
entities.materialize(itemSchema, partialLine);
```

The returned schema has a synthesized `$id` of the form `<parent.$id>#<pointer>` and is
automatically registered in the calling registry so subsequent operations work directly.
