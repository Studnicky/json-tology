# `register`, `registerAnonymous`, registry access

Schema management — registering, inspecting, and introspecting the schema registry.

---

## `JsonTology.register` {#registry-register}

**Declaration.** Registers one or more schemas and returns `this` with the schema types accumulated into the type map. Accepts a single schema object or an array. The `$id` of each schema must be unique. Schemas with `$ref` that reference other schemas must have those other schemas registered first (or registered in the same call). Returns `JsonTology<merged TMap>`.

**Use this when** you need to add schemas after construction, or when schemas are loaded from files at startup. Prefer `JsonTology.create({ schemas })` for known-at-compile-time schemas since it builds the full type map in one pass.

### Examples

#### Example 1: Construction-time registration (preferred)

```ts
import { JsonTology } from 'json-tology';

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    AddressSchema, CustomerSchema, BookSchema,
    OrderLineSchema, OrderSchema, ReviewSchema,
  ] as const,
});
```

#### Example 2: Post-construction registration

```ts
const jt = JsonTology.create({ baseIRI: 'https://bookstore.example' });
jt.set(AddressSchema).set(CustomerSchema);

// Or register an array:
jt.set([AddressSchema, CustomerSchema] as const);
```

#### Example 3: Register a composed schema immediately

```ts
import { Compose } from 'json-tology';
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price'] as const,
  'https://bookstore.example/BookSummary',
);
bookstoreEntities.set(BookSummarySchema);
console.log(bookstoreEntities.registry.has('https://bookstore.example/BookSummary')); // true
```

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

:::

---

## `JsonTology.registerAnonymous` {#registry-registeranonymous}

**Declaration.** Registers a schema that may not have a `$id`. If `$id` is absent, assigns a content-hash-based synthetic ID (`urn:json-tology:hash:<hex>`). If `$id` is present, delegates to `register`. Returns the `$id` string used for registration.

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

```ts
jt.registry.has('https://bookstore.example/Customer');     // true
jt.registry.has('https://bookstore.example/NonExistent');  // false

// Guard pattern:
function validateIfPresent(schemaId: string, data: unknown): ValidationErrors {
  if (!jt.registry.has(schemaId)) {
    return new ValidationErrors([{
      path: '', keyword: 'unknown',
      message: `Schema '${schemaId}' not registered`,
      params: {}
    }]);
  }
  return jt.validate(schemaId, data);
}
```

### `jt.registry.get(iri)` {#registry-get}

Retrieves the original schema object by `$id`. Returns `Record<string, unknown> | undefined`.

```ts
const book = jt.registry.get('https://bookstore.example/Book');
console.log(book?.properties?.['price']); // { exclusiveMinimum: 0, type: 'number' }

if (book) {
  const BookSummary = Compose.pick(
    book as typeof BookSchema,
    ['isbn', 'title', 'price'] as const,
    '...'
  );
}
```

### `jt.registry.keys()` / `values()` / `entries()` {#registry-iteration}

Standard Map iterators. `keys()` yields `$id` strings, `values()` yields schema objects, `entries()` yields `[iri, schema]` pairs.

```ts
const ids = [...jt.registry.keys()];
const bookstoreSchemas = ids.filter(id => id.startsWith('https://bookstore.example/'));

for (const schema of jt.registry.values()) { /* ... */ }
for (const [iri, schema] of jt.registry) { /* ... */ }   // direct for-of works too

jt.registry.forEach((schema, iri) => { /* ... */ });
jt.registry.size;   // number of registered schemas
```

### `jt.registry.set(iri, schema)` {#registry-set}

Map-style write. Replaces any existing entry at `iri`. The key must equal `schema.$id`; mismatches throw `SchemaError('SCHEMA_INVALID_INPUT')`. Returns the registry for chaining.

```ts
jt.registry
  .set(UserSchema.$id, UserSchema)
  .set(AddressSchema.$id, AddressSchema);
```

`jt.set(schema)` is the type-accumulating wrapper that calls `set` internally and widens the TypeScript type map. Use `register` when you want the new schema's shape reflected in subsequent `validate`/`instantiate`/`is` calls; use `set` for hot-reload or test-fixture replacement where the static type doesn't need to follow.

### `jt.registry.delete(iri)` {#registry-delete}

Returns `true` if a schema was removed, `false` if `iri` wasn't registered. Subsequent `$ref` resolution to the deleted IRI throws `GraphError('REF_UNRESOLVED')` on the next validate/instantiate call against any schema that points to it.

```ts
jt.registry.delete('https://bookstore.example/Customer');   // true
jt.registry.delete('https://bookstore.example/Customer');   // false
```

### `jt.registry.clear()` {#registry-clear}

Wipes every registered schema. Use in test teardown or when rebuilding the registry from scratch.

### `jt.registry.revision` {#registry-revision}

Monotonically increasing counter bumped on every mutation (`register`, `set`, `delete`, `clear`). External code that caches derived views (ontology builders, compiled graphs) snapshots the revision and rebuilds when it advances. `jt.ontology()` uses this internally.

## Related

- [`JsonTology.materialize`](/registry/materialize) - build instances from schemas
- [`Compose` methods](/composition/extend) - derive new schemas to register
- [`jt.toSchema`](/serialization/toSchema) - reconstruct schema from the canonical graph

## See also

- [Bookstore domain](/bookstore-domain) - where all six schemas are registered
