# Runtime decoding across packages

This page is for a consumer that (a) authors RDF/OWL **hash-namespace** schemas (`$id: 'https://ns#Class'`), (b) registers them in **one package** and calls `instantiate` / `InferType` from **another** — a monorepo with a schema-registry package and one or more consumer packages is the common shape — and (c) wants a fully typed result with **no hand-rolled types**. All three are supported today; this page walks the one end-to-end path that gets there, and the exact place `instantiate`'s return type stops being trustworthy across the package boundary.

If you searched for `REF_UNRESOLVED`, `unresolvedRef`, `RefNotFound`, `instantiate returns unknown`, `cross package`, or `monorepo`, this is the page.

---

## 1. Author with CURIE `$ref`s

A hash-namespace `$id` (`https://ns#Class`) is the idiomatic OWL form. The recommended way to reference a sibling schema in the same namespace is a CURIE `$ref` (`'ns:Class'`), not the expanded IRI:

<RunnableExample src="examples/docs/cross-package/producer-registry" />

`BookGenreSchema.properties.label` is `{ $ref: 'bk:BookGenreLabel' }` — a CURIE, resolved against the `bk` prefix registered on `JsonTology.create({ prefixes })`.

## 2. Register in the producer package

`JsonTology.create({ baseIri, prefixes, schemas })` registers both schemas and returns the registry instance (`genreEntities` above) that the producer package exports for consumers to call `instantiate` against. [`enableStrictGraph`](/advanced/strict-graph-mode) is on by default and is satisfied here: `label` is a `$ref` to a registered schema, not an inline constrained shape, so registration does not throw.

## 3. `InferType` with a CURIE-keyed reference map, in the consumer package

A consumer package that only imports the schema consts as **types** (not the runtime registry) derives its own precise type with `InferType` and a reference map keyed by the CURIE exactly as written in the `$ref`:

<!-- inline-ts-ok: illustrates the shape of a real two-package import (`@your-org/schema-registry` is not a package in this repo); the runnable two-file version is the RunnableExample below. -->
```ts
import type { InferType } from 'json-tology/types';
import type { BookGenreLabelSchema, BookGenreSchema } from '@your-org/schema-registry';

type BookGenreRefs = { 'bk:BookGenreLabel': typeof BookGenreLabelSchema };
type BookGenre = InferType<typeof BookGenreSchema, BookGenreRefs>;
```

The map key is `'bk:BookGenreLabel'` — the CURIE string as it appears in the schema's `$ref` — not the expanded IRI `'https://bookstore.example/ontology#BookGenreLabel'`. Get this wrong (or omit the map entirely) and `label` resolves to `RefNotFoundType<'bk:BookGenreLabel'>` instead of `string`. See [Troubleshooting: RefNotFoundType](/types/infer#troubleshooting-refnotfoundtype-kind-refnotfound-unresolvedref-in-an-inferred-type) for that failure mode and why hand-rolling a replacement type is the wrong fix.

## 4. `instantiate()` called from the other package

The consumer package calls `instantiate` on the registry it imported from the producer package:

<RunnableExample src="examples/docs/cross-package/consumer-typed-instantiate" />

## 5. Why `instantiate`'s return type can't be trusted here

`instantiate`'s return type is `ParseOutputType<TSchema, TRefs>`, where `TRefs` is the **registry's** reference map — built from the `schemas` array passed to `JsonTology.create`, and keyed by each schema's absolute `$id`. It is not the same map as the CURIE-keyed one you write locally for `InferType`, and it does not expand a CURIE `$ref` the way that local map does.

The example above proves this in a single compiled program, no package boundary required: `genreEntities.instantiate(BookGenreSchema.$id, ...)`'s inferred return type resolves `label` to `RefNotFoundType<'bk:BookGenreLabel'>`, because `TRefs` has an entry keyed `'https://bookstore.example/ontology#BookGenreLabel'`, not `'bk:BookGenreLabel'`. Across a real package boundary this gets worse, not better — the producer's compiled `.d.ts` may not preserve `TRefs` intact at all, so a real cross-package `instantiate` call can type its fields as `unknown` (this is the "instantiate returns unknown" report). Either way, the **runtime value** is validated identically; only the **type** `instantiate` reports for it is unreliable across the boundary.

## 6. The recommended idiom: re-derive locally, read the value into it

Don't lean on `instantiate`'s return type across a package boundary. Re-derive the type locally with `InferType` and the same reference map used everywhere else in the consumer package, and read the validated runtime value into that local type:

<!-- inline-ts-ok: `data` is illustrative caller input, not a concrete value; the runnable form of this exact idiom is the RunnableExample above (examples/docs/cross-package/consumer-typed-instantiate). -->
```ts
const raw = genreEntities.instantiate(BookGenreSchema.$id, data);
const genre: BookGenre = raw as unknown as BookGenre;
```

The double cast documents that `instantiate`'s own return type cannot be trusted for this field — not that the runtime value is untrusted. `instantiate` already validated `data` against the schema (including running any registered `Transform` decoders and filling defaults — see [Canonical decode/default ordering](/instantiate-vs-materialize#canonical-decode-default-ordering)) before this line runs; the cast only bridges the type, not the runtime check.

---

## Summary

| Layer | What resolves the `$ref` | Keyed by |
|---|---|---|
| Runtime (`instantiate`, `validate`) | The registry's `RefDecoder` | CURIE or absolute IRI, as registered — both work at runtime |
| Local type (`InferType<S, Refs>`) | The `Refs` map you pass | The `$ref` string exactly as authored (CURIE or IRI) |
| `instantiate`'s return type (`ParseOutputType<S, TRefs>`) | The registry's own `TRefs` | The schema's absolute `$id` — does not expand a CURIE `$ref`, and may not survive a `.d.ts` boundary |

One authoring convention (CURIE `$ref`s for a hash-namespace registry) serves the runtime and the type layer identically. The one thing it does not serve is `instantiate`'s own return type across a package boundary — for that, re-derive locally.

## Related

- [Schemas: `$ref` cross-schema references](/schemas#ref-cross-schema-references) - the runtime resolution rule
- [Types: InferType](/types/infer) - reference maps, `RefNotFoundType`, downstream-required defaults
- [`instantiate` vs `materialize`](/instantiate-vs-materialize) - decode/default ordering
- [Your types are already a graph](/your-types-are-a-graph) - the graph model these schemas sit in
- [Strict graph mode](/advanced/strict-graph-mode) - `enableStrictGraph` and inline-shape enforcement
