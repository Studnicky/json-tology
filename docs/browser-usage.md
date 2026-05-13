---
title: Browser usage
description: Using json-tology in browser environments without Node.js
---

# Browser usage

json-tology is browser-safe by default. The main entry, value operations, ontology serializers, and visualization renderer have zero dependencies on Node.js APIs.

## What works in the browser

All of these import paths work in a browser bundle:

| Entry | Status |
|---|---|
| `json-tology` | Full library — register schemas, validate, instantiate, encode/decode, ontology emission, viz |
| `json-tology/value` | `Changeset`, `Hash`, value operations |
| `json-tology/schema` | Composition, transforms, format registry, validation compiler (excludes `SchemaLoader`) |
| `json-tology/ontology` | RDF/OWL/SHACL serializers |
| `json-tology/viz` | HTML renderer for schema visualization |
| `json-tology/types` | Type aliases (zero runtime) |
| `json-tology/interfaces` | Interface declarations (zero runtime) |

## What does not work

- `json-tology/schema` does NOT expose `SchemaLoader` in browser bundles. `SchemaLoader` reads schemas from disk via `node:fs` — there is no browser equivalent. If you need to load schemas dynamically in a browser, fetch the JSON and call `jt.register(parsedSchema)`.
- The `json-tology` CLI binary is Node-only.

## Native ESM via CDN

```html
<script type="module">
  import { JsonTology } from 'https://esm.sh/json-tology';

  const jt = JsonTology.create({
    baseIRI: 'https://example.com',
    schemas: [{
      $id: 'https://example.com/User',
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' }
      },
      required: ['name']
    }]
  });

  const valid = jt.is('https://example.com/User', { name: 'Ada' });
  console.log(valid); // true
</script>
```

## Bundled (Vite, webpack, esbuild, Rollup)

Bundlers see the `"browser"` and `"default"` conditions in the `exports` map and resolve to a `SchemaLoader`-free variant of `json-tology/schema`.

```ts
import { JsonTology } from 'json-tology';
import { Compose } from 'json-tology/schema';

const ExtendedSchema = Compose.extend(BaseSchema, {
  properties: { newField: { type: 'string' } }
});

const jt = JsonTology.create({ baseIRI, schemas: [ExtendedSchema] });
```

No polyfills are required. The bundle has zero Node API dependencies.

## Pre-bundled artifact

For environments without a build step, the package ships a pre-bundled ESM artifact:

```html
<script type="module" src="https://esm.sh/json-tology/browser"></script>
```

This artifact is built from `src/index.ts` via esbuild with `platform: 'browser'`, ES2022 target, tree-shaken, and source-mapped.

## See also

- [Getting started](/getting-started) — schema authoring basics
- [Validation modes](/validation-modes) — compile-time vs runtime behavior
