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

```ts
import { JsonTology, Loaders } from 'json-tology';
import UserSchema from './schemas/User.json';
import AddressSchema from './schemas/Address.json';

// Pre-bundle local schemas; fall back to network for remote refs
const snapshot = await JsonTology.prefetch({
  loader: Loaders.compose(
    Loaders.memory({ /* additional compile-time schemas */ }),
    Loaders.fetch({ base: 'https://schemas.myapp.io/v1/' }),
  ),
  schemas: [UserSchema, AddressSchema],
});

const jt = JsonTology.create({
  baseIRI: 'https://myapp.io',
  prefetched: snapshot,
  schemas: [UserSchema, AddressSchema] as const,
});
```

## Node (same API)

```ts
import { JsonTology, Loaders } from 'json-tology';

const snapshot = await JsonTology.prefetch({
  loader: Loaders.cached(
    Loaders.fetch({ base: 'https://schemas.example/' })
  ),
  schemas: [UserSchema],
});

const jt = JsonTology.create({
  baseIRI: 'https://myapp.io',
  prefetched: snapshot,
  schemas: [UserSchema] as const,
});
```

For local file loading, write a four-line fs loader:

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const fsLoader = async (iri: string) => {
  try {
    const file = path.join('/schemas', new URL(iri).pathname + '.json');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch { return null; }
};
```

## Schema-only (no $ref federation)

If all schemas are known at build time and have no external `$ref`s, skip `prefetch` entirely:

```ts
const jt = JsonTology.create({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema, AddressSchema, OrderSchema] as const,
});
```

## Key points

- No `browser`/`node`/`default` conditional export paths on any json-tology subpath.
- `Loaders` helpers use only `globalThis.fetch` and `Promise` — no Node built-ins.
- `JsonTology.create` is synchronous. Async fetching is isolated to `JsonTology.prefetch`.
- The library has zero runtime dependencies beyond `commander` (CLI only).
