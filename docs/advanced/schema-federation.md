# Schema federation

json-tology resolves `$ref` IRIs at registration time. By default, all referenced schemas must be registered before first use. The registry throws `GraphError('REF_UNRESOLVED')` if a non-fragment IRI points to an unregistered schema.

The **loader hook** is a single async function that fetches schemas on demand:

<RunnableExample src="examples/docs/advanced/89-loaders-type-signature" />

Async work is isolated to a single entry point: `JsonTology.prefetch`, which builds a snapshot. `JsonTology.create` is synchronous on every call site and consumes the snapshot through the `prefetched` option.

## Prefetch + sync create

`JsonTology.prefetch` walks transitive `$ref`s via the loader and returns a snapshot. The snapshot is loader-agnostic; pass it to `create()` via the `prefetched` option for sync consumption.

<RunnableExample src="examples/docs/advanced/71-prefetch-bundler-compose" />

`prefetch` accepts:
- `loader`: required.
- `schemas`: seed schemas whose refs are followed.
- `rootIds`: IRIs to load directly from the loader (no local seed required).
- `baseIRI`: used by the ephemeral walker; defaults to a static placeholder when omitted.

## How the resolution walk works

1. `prefetch` registers any `schemas` provided as seeds, then loads each `rootIds` IRI.
2. The walker iterates registered schemas and collects every non-fragment cross-schema `$ref` IRI not yet present.
3. Each unresolved IRI is passed to the loader. If the loader returns `null`, the walk throws `GraphError('REF_UNRESOLVED')` with the offending IRI in `err.pointer`.
4. Returned schemas are registered and recursed into; their own `$ref`s are added to the queue.
5. A `Set<string>` of visited IRIs prevents calling the loader twice for the same IRI.
6. The walker captures every resolved schema into `snapshot.schemas` keyed by `$id`.

## Built-in loader helpers

The `Loaders` namespace ships four universal helpers that work in Node ≥ 18, Bun, Deno, and browsers.

### `Loaders.fetch`

Uses `globalThis.fetch`. Works anywhere. 4xx/5xx → `null`. Network errors propagate.

<RunnableExample src="examples/docs/advanced/87-loaders-fetch-options" />

### `Loaders.memory`

In-memory lookup. Accepts a `Map` or plain object. Zero I/O.

<RunnableExample src="examples/docs/advanced/58-loaders-memory" />

### `Loaders.compose`

Chains multiple loaders. Returns the first non-null result.

<RunnableExample src="examples/docs/advanced/59-loaders-compose" />

### `Loaders.cached`

Wraps any loader with an LRU cache (default: 1024 entries). Both resolved schemas and `null` results are cached so the inner loader is called at most once per IRI.

<RunnableExample src="examples/docs/advanced/60-loaders-cached" />

## Write your own loader

Any function with the signature `(iri: string) => Promise<JsonSchemaType | null>` is a valid loader. Node `fs` example:

<RunnableExample src="examples/docs/advanced/61-loaders-fs-custom" />

## Adding schemas after construction

`jt.set(schema)` is synchronous and throws `REF_UNRESOLVED` for any unregistered cross-schema refs. For schemas whose transitive refs are not yet known locally, build a fresh snapshot with `JsonTology.prefetch` and pass it through `prefetched` on a new `JsonTology.create` call, or merge the new schemas into the existing registry by calling `set()` once every dependency is in scope.

## Performance notes

- **Cache the loader.** Wrap with `Loaders.cached()` so schemas fetched in one walk are not re-fetched if `prefetch` is called again.
- **Bundle critical schemas.** `Loaders.compose(Loaders.memory(bundled), Loaders.fetch(...))` serves critical schemas from memory with the network as fallback.
- **Snapshot at build time.** Run `prefetch` in a build step and persist the resulting `snapshot.schemas` map; consume it at runtime with zero network calls.

## Error handling

| Condition | Result |
|-----------|--------|
| Loader returns `null` for a required IRI | `GraphError('REF_UNRESOLVED')` with the IRI in `err.pointer` |
| Loader throws (network error) | Error propagates; callers see the real failure |
| Loader returns a schema with new unresolved `$ref`s | Those IRIs are queued and resolved transitively |
| Same IRI encountered twice in one walk | Loader called at most once (visited-set dedup) |

## Comparison with similar mechanisms

| Feature | json-tology | AJV `loadSchema` | SPARQL `SERVICE` |
|---------|-------------|------------------|-----------------|
| Protocol-agnostic | Yes | Yes | HTTP only |
| Sync `create()` after prefetch | Yes | No (async compile) | N/A |
| Cycle detection | Visited-set dedup | Manual | Depends on engine |
| Universal (Node/browser) | Yes | Yes | Server-side only |
| Built-in caching | `Loaders.cached` | None | Endpoint-level |
