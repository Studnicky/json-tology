/**
 * Cross-package typing — the "consumer" side.
 *
 * Imports the registry instance and the schema consts from the producer
 * module (standing in for a separate npm package) and does the two things a
 * cross-package consumer needs: validate untrusted data with `instantiate`,
 * and get a precise local TypeScript type for the result via `InferType` +
 * a CURIE-keyed reference map.
 *
 * `instantiate`'s own return type is `ParseOutputType<TSchema, TRefs>`,
 * where `TRefs` is the *registry's* reference map — keyed by the absolute
 * `$id`s passed to `JsonTology.create({ schemas })`. It does not expand a
 * CURIE `$ref` the way a local CURIE-keyed `InferType` map does: `label`'s
 * `$ref` is `'bk:BookGenreLabel'`, but `TRefs` only has an entry keyed
 * `'https://bookstore.example/ontology#BookGenreLabel'`, so the assignment
 * `const genre: BookGenre = raw;` fails to typecheck right here in this
 * single compiled example — `raw.label` types as `ReferenceNotFoundType<'bk:BookGenreLabel'>`,
 * not `string`. Across a real package boundary this gets worse, not better:
 * the producer's compiled `.d.ts` may not preserve `TRefs` at all, so a
 * real cross-package `instantiate` call can type its fields as `unknown`
 * (sometimes reported as "instantiate returns unknown" in a monorepo /
 * cross package setup) even though the runtime value underneath is
 * identical and fully validated.
 *
 * The recommended idiom is the same either way: re-derive the type locally
 * with `InferType` and the same reference map, and read the validated
 * runtime value into that local type instead of leaning on `instantiate`'s
 * return type.
 */

import type { InferType } from '../../../src/types/index.js';
import type { BookGenreLabelSchema } from './producer-registry.js';
import {
  BookGenreSchema, genreEntities
} from './producer-registry.js';

// Local reference map, keyed by the CURIE exactly as written in
// BookGenreSchema's $ref ('bk:BookGenreLabel') — not the expanded IRI.
type BookGenreRefs = { 'bk:BookGenreLabel': typeof BookGenreLabelSchema; };
type BookGenre = InferType<typeof BookGenreSchema, BookGenreRefs>;

// The runtime value: validated, defaults filled, decoders run — identical
// whether this call happens in the same package or a consumer package.
const raw = genreEntities.instantiate(BookGenreSchema.$id, { 'label': 'Fantasy' });

// Recommended idiom: read the validated value into the locally re-derived
// type. `raw`'s inferred type carries ReferenceNotFoundType for `label` (see
// above), so the bridge is a double cast through `unknown` — it documents
// that instantiate's own return type cannot be trusted for this field, not
// that the runtime value itself is untrusted; the value was already
// validated by instantiate() before this line runs.
const genre: BookGenre = raw as unknown as BookGenre;

console.assert(genre.label === 'Fantasy');
console.log('genre.label:', genre.label);
console.log('Local type re-derived with InferType + CURIE-keyed reference map.');
