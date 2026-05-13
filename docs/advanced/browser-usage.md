# Browser usage

json-tology has no environment-specific export paths. The same `import` works in Node, Bun, Deno, and browsers — no conditional `browser`/`node` exports to navigate. The only tool for loading schemas from a remote source is the **loader hook**, which uses `globalThis.fetch` and therefore runs identically everywhere.

## CDN (no bundler)

```html
<script type="module">
  import { JsonTology, Loaders } from 'https://esm.sh/json-tology';

  const jt = await JsonTology.create({
    baseIRI: 'https://myapp.io',
    schemas: [],
    loader: Loaders.fetch({ base: 'https://schemas.myapp.io/v1/' }),
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
const jt = await JsonTology.create({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema, AddressSchema] as const,
  loader: Loaders.compose(
    Loaders.memory({ /* additional compile-time schemas */ }),
    Loaders.fetch({ base: 'https://schemas.myapp.io/v1/' }),
  ),
});
```

## Node (same API)

```ts
import { JsonTology, Loaders } from 'json-tology';

const jt = await JsonTology.create({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema] as const,
  loader: Loaders.cached(
    Loaders.fetch({ base: 'https://schemas.example/' })
  ),
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

If all schemas are known at build time and have no external `$ref`s, skip the loader entirely:

```ts
// Fully synchronous — no await
const jt = JsonTology.create({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema, AddressSchema, OrderSchema] as const,
});
```

## Key points

- No `browser`/`node`/`default` conditional export paths on any json-tology subpath.
- All helpers in the `Loaders` namespace use only `globalThis.fetch` and `Promise` — no Node built-ins.
- `JsonTology.create({ loader })` returns `Promise<JsonTology>`. The hot path (`validate`, `instantiate`, `is`, etc.) is synchronous after the promise resolves.
- The library has zero runtime dependencies beyond `commander` (CLI only).
