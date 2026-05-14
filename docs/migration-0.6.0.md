# Migration to 0.6.0

0.6.0 is a pre-1.0 release. The breaking changes listed here follow the project's clean-break policy: removed symbols are gone with no shims or deprecation wrappers.

## `loader` option removed from `JsonTology.create`

Async transitive `$ref` resolution moves to `JsonTology.prefetch`, which returns a snapshot. `JsonTology.create` is synchronous on every call site and accepts the snapshot through the new `prefetched` option.

```ts
// Before
const jt = await JsonTology.create({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema] as const,
  loader: Loaders.fetch({ base: 'https://schemas.example/v1/' }),
});

// After
const snapshot = await JsonTology.prefetch({
  loader: Loaders.fetch({ base: 'https://schemas.example/v1/' }),
  schemas: [UserSchema],
});

const jt = JsonTology.create({
  baseIRI: 'https://myapp.io',
  prefetched: snapshot,
  schemas: [UserSchema] as const,
});
```

The `prefetch` walker accepts `schemas` (seed schemas whose refs are followed), `rootIds` (IRIs to load directly), and optional `baseIRI`. It returns a `SnapshotInterface { version: 1; schemas: ReadonlyMap<string, JsonSchemaType>; provenance? }` keyed by `$id`.

When `prefetched` is supplied, schemas passed via `schemas` register first; entries from the snapshot then fill any IRIs not already in the registry — `schemas` wins on collision.

## `jt.registerAsync(schema)` removed

Post-construction loader-driven registration is gone. Build a fresh snapshot with `JsonTology.prefetch` and construct a new instance.

```ts
// Before
const jt = await JsonTology.create({ baseIRI, loader });
await jt.registerAsync(OrderSchema);

// After
const snapshot = await JsonTology.prefetch({ loader, schemas: [OrderSchema] });
const jt = JsonTology.create({ baseIRI, prefetched: snapshot });
```

`jt.set(schema)` is unchanged and remains the sync path for schemas whose refs are already in scope.

## `register` → `set` (Map-native naming)

`register` is gone from `SchemaRegistryInterface`, `JsonTology`, and `FormatRegistryInterface`. The merged write method is `set`, with three overloads that match how schemas were previously registered:

```ts
// Before
jt.register(UserSchema);
jt.register([UserSchema, AddressSchema] as const);
jt.registry.register(UserSchema);
formatRegistry.register('phone', validator);

// After
jt.set(UserSchema);                           // single, widens TMap
jt.set([UserSchema, AddressSchema] as const); // bulk, widens TMap
jt.registry.set(UserSchema);                  // registry-level, no widening
jt.registry.set(UserSchema.$id, UserSchema);  // Map-style key + value
formatRegistry.set('phone', validator);
```

Semantics change: `set` replaces silently when the key already exists, matching `Map.set`. The previous `register`-with-different-content throw is gone. Identical-content writes silently replace too. `registerAnonymous` stays — it computes a hash key, a different verb from `Map.set`.

## `register` → `set` (Map-native naming, schema-first ordering)

`register` is gone from `SchemaRegistryInterface`, `JsonTology`, and `FormatRegistryInterface`. The replacement is `set`. The schema is always the first argument; an explicit IRI follows as an optional second arg for non-canonical aliasing. Bulk writes accept an array where each entry is either a schema or a `[schema, iri]` tuple.

```ts
// Before
jt.register(UserSchema);
jt.register([UserSchema, AddressSchema] as const);
jt.registry.register(UserSchema);
formatRegistry.register('phone', validator);

// After
jt.set(UserSchema);                                 // single, widens TMap
jt.set([UserSchema, AddressSchema] as const);       // bulk, widens TMap
jt.set(UserSchema, 'urn:alias');                    // explicit aliasing key
jt.set([[UserSchema, 'urn:alias'], AddressSchema]); // mixed bulk: tuple + schema
jt.registry.set(UserSchema);                        // registry-level, no widening
formatRegistry.set('phone', validator);             // FormatRegistry keeps (name, validator)
```

Semantics change: `set` replaces silently when the key already exists, matching `Map.set`. The previous `register`-with-different-content throw is gone. `registerAnonymous` stays — it computes a hash key, a different verb.

## Registry reads go through `jt.registry`

The facade methods `jt.has`, `jt.get`, and `jt.list` are removed. There is one path to registry reads — `jt.registry`, which exposes the read surface of a native `Map`.

```ts
// Before
jt.has(iri);
jt.get(iri);
jt.list();

// After
jt.registry.has(iri);
jt.registry.get(iri);
[...jt.registry.keys()];
```

Additional Map-like access points: `jt.registry.values()`, `jt.registry.entries()`, `jt.registry.forEach(cb)`, `jt.registry.size`, and `for...of` iteration yielding `[iri, schema]` pairs.

Writes also follow `Map`:

```ts
jt.registry.set(UserSchema.$id, UserSchema);   // replace; key must equal schema.$id
jt.registry.delete('urn:User');                 // returns boolean
jt.registry.clear();                            // wipe
```

`jt.set(schema)` remains as the type-accumulating wrapper around `set` — use it when you want the new schema's static type reflected in subsequent `validate`/`instantiate` calls; use `set` directly for hot-reload or test-fixture replacement where the static type doesn't need to follow.

`jt.registry.revision` is bumped on every mutation. External code that caches derived views (ontology builders, compiled graphs) snapshots the revision and rebuilds when it advances; `jt.ontology()` uses this internally so it no longer needs explicit invalidation.
