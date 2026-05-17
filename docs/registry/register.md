# `set`, `registerAnonymous`, registry access

Schema management — adding, inspecting, and introspecting the schema registry.

---

## `JsonTology.set` {#registry-set}

**Declaration.** Adds or replaces one or more schemas and returns `this` with the schema types accumulated into the type map. The schema is always the first argument:

- `set(schema)` — single; key derived from `schema.$id`.
- `set(schema, iri)` — explicit key; for non-canonical aliasing.
- `set([schema | [schema, iri], ...])` — bulk; each entry is a schema or `[schema, iri]` tuple.

Schemas with `$ref` that reference other schemas must have those other schemas in the registry first (or supplied in the same `set` call). Replaces silently on `$id` collision, per `Map.set` semantics.

Returns `JsonTology<merged TMap>` so the new schema's static type is visible to subsequent `validate` / `instantiate` / `is` calls.

**Use this when** you need to add schemas after construction, or when schemas are loaded from files at startup. Prefer `JsonTology.create({ schemas })` for known-at-compile-time schemas since it builds the full type map in one pass.

### Examples

#### Example 1: Construction-time registration (preferred)

<<< ../../examples/docs/registry/01-register.ts

#### Example 2: Post-construction registration

<<< ../../examples/docs/registry/02-register-post-construction.ts

#### Example 3: Register a composed schema immediately

<<< ../../examples/docs/registry/03-composed-register.ts

### Comparison

::: code-group

```ts [json-tology]
jt.set(BookSchema);
// Or: JsonTology.create({ schemas: [...] as const })
```

```ts [Zod]
// Zod schemas are module-scope  - no registry. Import the schema object directly.
```

```ts [Valibot]
// Limitation: Valibot has no registry concept. Each schema is an isolated
// value; cross-schema reference is structural - import the schema and embed it.
import { BookSchema } from './bookstore.js';
```

```ts [io-ts]
// Limitation: io-ts has no registry concept. Codecs are values exported from
// modules; cross-codec reference is structural via t.intersection / t.union /
// t.recursion (for self-referential cases). No central $id-keyed lookup.
import { BookCodec } from './bookstore.js';
```

```ts [TypeBox + Value]
// TypeBox schemas are plain objects  - no registry concept.
```

```ts [AJV]
ajv.addSchema(bookSchema);
// Or: ajv.addSchema([schema1, schema2])
```

```py [Pydantic]
# Pydantic registers via the Python class system automatically.
# No explicit registry call needed.
```


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

---

## `JsonTology.registerAnonymous` {#registry-registeranonymous}

**Declaration.** Registers a schema that may not have a `$id`. If `$id` is absent, assigns a content-hash-based synthetic ID (`urn:json-tology:hash:<hex>`). If `$id` is present, delegates to `set`. Returns the `$id` string used for registration.

**Use this when** you receive schemas from external sources (OpenAPI `$defs`, dynamic form builders) that may not carry a stable `$id`.

### Examples

```ts
const syntheticId = jt.registerAnonymous({
  type: 'object',
  properties: {
    couponCode: { type: 'string' },
    discount:   { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['couponCode', 'discount'],
});

console.log(syntheticId); // 'urn:json-tology:hash:<hex>'
jt.validate(syntheticId, { couponCode: 'SAVE10', discount: 0.1 });
```

---

## `jt.registry` — the Map-native interface {#registry-access}

`jt.registry` mirrors the surface of a native `Map<string, Schema>`. Reads (`has`, `get`, `keys`, `values`, `entries`, `forEach`, `size`, `for...of`) and writes (`set`, `delete`, `clear`) are spelled exactly as on `Map`. No facade aliases on `JsonTology` itself; everything goes through the registry.

`set` requires the key to equal the schema's `$id`. `clear` and `delete` are constant-time. Every mutation bumps `jt.registry.revision`; callers cache derived views (ontology builders, externally cached graphs) by snapshotting the revision and rebuilding when it advances.

### `jt.registry.has(iri)` {#registry-has}

`O(1)` lookup. Returns `true` if a schema with the given `$id` is registered.

<<< ../../examples/docs/registry/04-registry-has.ts

### `jt.registry.get(iri)` {#registry-get}

Retrieves the original schema object by `$id`. Returns `Record<string, unknown> | undefined`.

<<< ../../examples/docs/registry/05-registry-get.ts

### `jt.registry.keys()` / `values()` / `entries()` {#registry-iteration}

Standard Map iterators. `keys()` yields `$id` strings, `values()` yields schema objects, `entries()` yields `[iri, schema]` pairs.

<<< ../../examples/docs/registry/06-registry-iteration.ts

### `jt.registry.set(schema, iri?)` {#registry-set-method}

Map-style write. Schema is always the first argument; key is derived from `schema.$id`. Pass an explicit `iri` only for non-canonical aliasing — passing one that disagrees with `schema.$id` throws `SchemaError('SCHEMA_INVALID_INPUT')`. Bulk writes accept an array of schemas or `[schema, iri]` tuples. Replaces silently on collision per `Map.set`. Returns the registry for chaining.

<<< ../../examples/docs/registry/07-registry-set-method.ts

`jt.set(schema)` is the type-accumulating wrapper that calls `registry.set` internally and widens the TypeScript type map. Use `jt.set` when you want the new schema's shape reflected in subsequent `validate`/`instantiate`/`is` calls; use `jt.registry.set` for hot-reload or test-fixture replacement where the static type doesn't need to follow.

### `jt.registry.delete(iri)` {#registry-delete}

Returns `true` if a schema was removed, `false` if `iri` wasn't registered. Subsequent `$ref` resolution to the deleted IRI throws `GraphError('REF_UNRESOLVED')` on the next validate/instantiate call against any schema that points to it.

```ts
jt.registry.delete('https://bookstore.example/Customer');   // true
jt.registry.delete('https://bookstore.example/Customer');   // false
```

### `jt.registry.clear()` {#registry-clear}

Wipes every registered schema. Use in test teardown or when rebuilding the registry from scratch.

### `jt.registry.revision` {#registry-revision}

Monotonically increasing counter bumped on every mutation (`set`, `delete`, `clear`). External code that caches derived views (ontology builders, compiled graphs) snapshots the revision and rebuilds when it advances. `jt.ontology()` uses this internally.

## Related

- [`JsonTology.materialize`](/registry/materialize) - build instances from schemas
- [`Compose` methods](/composition/extend) - derive new schemas to register
- [`jt.toSchema`](/serialization/toSchema) - reconstruct schema from the canonical graph

## See also

- [Bookstore domain](/bookstore-domain) - where all six schemas are registered
