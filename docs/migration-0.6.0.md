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

`jt.register(schema)` is unchanged and remains the sync path for schemas whose refs are already in scope.

## `SchemaRegistryInterface` Map-like read surface

The registry now exposes the read methods of a native `Map`. `jt.registry.has(iri)`, `keys()`, `values()`, `entries()`, `forEach(cb)`, `size`, and `for...of` iteration (yielding `[iri, schema]` pairs) are all available. Existing methods (`get`, `list`, `register`, etc.) are unchanged. No removal methods are exposed — registration semantics differ from `Map.set`/`delete`.
