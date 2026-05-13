# Schema federation

json-tology resolves `$ref` IRIs at registration time. By default, all referenced schemas must be registered before first use — the registry throws `GraphError('REF_UNRESOLVED')` if a non-fragment IRI points to an unregistered schema.

The **loader hook** is a single async function that extends this mechanism to fetch schemas on demand:

```ts
type LoaderType = (iri: string) => Promise<JsonSchemaType | null>;
```

Pass it at construction time. `JsonTology.create()` returns a `Promise<JsonTology>` that is fully resolved before any hot-path method is called:

```ts
import { JsonTology, Loaders } from 'json-tology';

const jt = await JsonTology.create({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema],
  loader: Loaders.cached(
    Loaders.fetch({ base: 'https://schemas.example/v1/' })
  ),
});

// Hot path is synchronous — no await needed
jt.validate(UserSchema, data);
```

## How the resolution walk works

1. After `schemas` are registered, the walker iterates all registered schemas.
2. For each schema, it collects every non-fragment cross-schema `$ref` IRI that is not yet in the registry.
3. Each unresolved IRI is passed to the loader. If the loader returns `null`, the walk throws `GraphError('REF_UNRESOLVED')` with the offending IRI in `err.pointer`.
4. Returned schemas are registered and recursed into — their own `$ref`s are added to the queue.
5. A `Set<string>` of visited IRIs prevents calling the loader twice for the same IRI within a single walk.
6. The resolved instance is identical to a statically-registered instance — all methods stay synchronous.

## Built-in helpers

The `Loaders` namespace ships four universal helpers that work in Node ≥ 18, Bun, Deno, and browsers.

### `Loaders.fetch`

Uses `globalThis.fetch`. Works anywhere. 4xx/5xx → `null`. Network errors propagate.

```ts
Loaders.fetch()                           // fetch from the IRI directly
Loaders.fetch({ base: 'https://cdn.example/schemas/' })  // resolve relative IRIs
Loaders.fetch({ init: { headers: { 'X-Api-Key': key } } })
```

### `Loaders.memory`

In-memory lookup. Accepts a `Map` or plain object. Zero I/O.

```ts
Loaders.memory({ [UserSchema.$id]: UserSchema, [AddressSchema.$id]: AddressSchema })
Loaders.memory(new Map([[UserSchema.$id, UserSchema]]))
```

### `Loaders.compose`

Chains multiple loaders. Returns the first non-null result.

```ts
Loaders.compose(
  Loaders.memory(localSchemas),          // pre-bundled fast path
  Loaders.fetch({ base: 'https://cdn.example/' })  // fallback to network
)
```

### `Loaders.cached`

Wraps any loader with an LRU cache (default: 1024 entries). Both resolved schemas and `null` results are cached so the inner loader is called at most once per IRI.

```ts
Loaders.cached(Loaders.fetch())            // default maxSize (1024)
Loaders.cached(Loaders.fetch(), { maxSize: 256 })
```

## Write your own loader

Any function with the signature `(iri: string) => Promise<JsonSchemaType | null>` is a valid loader. Node `fs` example:

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const fsLoader = async (iri: string): Promise<Record<string, unknown> | null> => {
  const filename = path.join('/schemas', new URL(iri).pathname + '.json');

  try {
    const content = await fs.readFile(filename, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const jt = await JsonTology.create({ baseIRI: 'https://myapp.io', loader: fsLoader });
```

## Post-construction registration

`jt.registerAsync(schema)` follows the same eager-resolve walk after registering a new schema. It requires a loader at construction time:

```ts
const jt = await JsonTology.create({
  baseIRI: 'https://myapp.io',
  loader: Loaders.fetch({ base: 'https://schemas.example/' }),
});

await jt.registerAsync(OrderSchema);  // walks transitive refs of OrderSchema
```

Sync `jt.register(schema)` still exists and still throws `REF_UNRESOLVED` for any unregistered cross-schema refs — it does not call the loader.

## Performance notes

- **Pre-warm at boot.** Pass all known schemas in the `schemas` array at construction. The loader is only called for schemas not already present.
- **Cache the loader.** Wrap with `Loaders.cached()` so schemas fetched in one session are not re-fetched if `registerAsync` is called later.
- **Bundle critical schemas.** Use `Loaders.compose(Loaders.memory(bundled), Loaders.fetch(...))` so critical schemas are served from memory and the network is a fallback.

## Error handling

| Condition | Result |
|-----------|--------|
| Loader returns `null` for a required IRI | `GraphError('REF_UNRESOLVED')` with the IRI in `err.pointer` |
| Loader throws (network error) | Error propagates — callers see the real failure |
| Loader returns a schema with new unresolved `$ref`s | Those IRIs are queued and resolved transitively |
| Same IRI encountered twice in one walk | Loader called at most once (visited-set dedup) |

## Comparison with similar mechanisms

| Feature | json-tology loader | AJV `loadSchema` | SPARQL `SERVICE` |
|---------|-------------------|------------------|-----------------|
| Protocol-agnostic | Yes | Yes | HTTP only |
| Sync hot path after init | Yes | No (async validate) | N/A |
| Cycle detection | Visited-set dedup | Manual | Depends on engine |
| Universal (Node/browser) | Yes | Yes | Server-side only |
| Built-in caching | `Loaders.cached` | None | Endpoint-level |
