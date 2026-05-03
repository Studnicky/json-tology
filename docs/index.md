---
layout: home

hero:
  name: json-tology
  text: TypeScript types from JSON Schema.
  tagline: Author once with JSON Schema. Get typed validation, parsing, defaults, transforms, and serialization. Pydantic-style ergonomics for TypeScript.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/Studnicky/json-tology

features:
  - title: Compile-time Types
    details: InferType<typeof Schema> derives the TypeScript type from your as-const schema literal. No code generation, no separate type definition.
  - title: Runtime Validation
    details: validate(), is(), errors() check data against a registered schema and return structured ValidationErrors with JSON Pointer paths.
  - title: Coercion with Defaults
    details: coerce() validates, applies defaults, runs Transform decoders, and strips unknown properties in one pass. Throws a typed CoercionError on failure.
  - title: Composition
    details: extend, pick, omit, partial, required, intersection, discriminatedUnion — Pydantic-style derivations from base schemas, all type-safe.
  - title: Transforms and Brands
    details: Per-field decode/encode pipelines via Transform, plus brand types for nominal typing. Round-trip wire format ↔ decoded values with type safety.
  - title: Tree-Shakable
    details: Sub-path exports — json-tology/value, json-tology/schema, json-tology/types — let users opt into only what they need. Graph and ontology are fully tree-shakable.
---

## Why json-tology

If you're coming from Pydantic, Zod, or TypeBox, json-tology gives you the same authoring ergonomics with **JSON Schema as the source of truth** — your schema works in TypeScript, in JSON Schema validators, in OpenAPI, in IDE auto-complete, and as a wire-format contract, all from one declaration.

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology';

const CustomerSchema = {
  $id: 'https://bookstore.example/Customer',
  type: 'object',
  properties: {
    id:        { type: 'string', format: 'uuid' },
    email:     { type: 'string', format: 'email' },
    name:      { type: 'string' },
    addresses: { type: 'array', items: { type: 'object' }, default: [] },
  },
  required: ['id', 'email', 'name'],
} as const;

type Customer = InferType<typeof CustomerSchema>;
//   ^? { readonly id: string; readonly email: string; readonly name: string; readonly addresses?: readonly object[] }

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CustomerSchema] as const,
});

const customer = jt.coerce(CustomerSchema.$id, {
  id: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name: 'Alice Chen',
});
//    ^? Customer — typed, validated, defaults applied
```

That's the entire core. Validation, type inference, coercion, defaults — all from one schema literal.

## What's in the box

| You get | Without paying for |
|---------|--------------------|
| Type inference (`InferType`) | A separate type-definition language |
| Runtime validation (`validate`, `is`, `errors`) | A second schema for runtime checks |
| Coercion + defaults (`coerce`) | Manual mapping of input shapes |
| Field aliasing (`jt:alias`) | Custom transform layers for renames |
| Computed fields (`jt:computed`) | Post-processing pipelines |
| Cross-field invariants (`addInvariant`) | Custom validation glue |
| Serialization (`dump`, `dumpJson`) | A separate serializer |
| Composition (`extend`, `pick`, `omit`, `partial`, `required`) | Hand-written derived schemas |

If you also need RDF/OWL/SHACL output, that's available as **opt-in advanced features** under the [Ontology and Graphs](/ontology) section. The core type-system path doesn't pay for any of it — `json-tology/value`, `json-tology/schema`, and `json-tology/types` exclude the graph and ontology modules entirely.

## Quick links

- **[Getting Started](/getting-started)** — install, define a schema, validate, coerce
- **[Bookstore Domain](/bookstore-domain)** — the running example domain used throughout the docs
- **[Validation](/validation/coerce)** — `coerce`, `validate`, `errors`, `is`, `validateAt`
- **[Error Views](/errors/views)** — `messages`, `format`, `flatten`, `aggregate`, `report` (RFC 7807)
- **[Type Inference](/types)** — how `InferType` works, reference maps, branded types
- **[Composition](/composition/extend)** — derive schemas from other schemas
- **[Serialization](/serialization/dump)** — `dump`, `dumpJson`, Transform encoders
- **[Ontology and Graphs](/advanced/ontology)** — *advanced:* OWL TBox, SHACL shapes, JSON-LD, ABox projection
