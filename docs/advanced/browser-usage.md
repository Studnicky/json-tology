# Browser usage

json-tology has no environment-specific export paths. The same `import` works in Node, Bun, Deno, and browsers — no conditional `browser`/`node` exports to navigate. Async schema fetching runs through the **loader hook** consumed by `JsonTology.prefetch`, which uses `globalThis.fetch` and therefore runs identically everywhere.

The shape is two steps: prefetch the snapshot once (async), then construct the instance synchronously anywhere from the snapshot.

## CDN (no bundler)

```html
<script type="module">
  import { JsonTology, Loaders } from 'https://esm.sh/json-tology';

  const snapshot = await JsonTology.prefetch({
    loader: Loaders.fetch({ base: 'https://schemas.myapp.io/v1/' }),
    rootIds: ['https://schemas.myapp.io/v1/User'],
  });

  const jt = JsonTology.create({
    baseIRI: 'https://myapp.io',
    prefetched: snapshot,
  });

  const result = jt.validate('https://schemas.myapp.io/v1/User', formData);
</script>
```

## Bundler (Vite, esbuild, webpack)

<<< ../../examples/docs/advanced/71-prefetch-bundler-compose.ts

## Node (same API)

<<< ../../examples/docs/advanced/72-prefetch-node-cached.ts

For local file loading, write a four-line fs loader:

<<< ../../examples/docs/advanced/61-loaders-fs-custom.ts

## Schema-only (no $ref federation)

If all schemas are known at build time and have no external `$ref`s, skip `prefetch` entirely:

<<< ../../examples/docs/advanced/73-schema-only-no-prefetch.ts

## Key points

- No `browser`/`node`/`default` conditional export paths on any json-tology subpath.
- `Loaders` helpers use only `globalThis.fetch` and `Promise` — no Node built-ins.
- `JsonTology.create` is synchronous. Async fetching is isolated to `JsonTology.prefetch`.
- The library has zero runtime dependencies beyond `commander` (CLI only).
