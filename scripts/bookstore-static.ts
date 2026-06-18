#!/usr/bin/env -S npx tsx
/**
 * Bookstore static facade demo.
 *
 * Shows the static-method form of the JsonTology API — useful for one-shot
 * validation / materialization calls without constructing a persistent registry.
 *
 * All static methods (`JsonTology.instantiate`, `JsonTology.materialize`,
 * `JsonTology.toQuads`, `JsonTology.validate`, `JsonTology.is`) create an
 * ephemeral, single-schema registry internally via `JsonTology.create`.
 * They are parametrised over the supplied schema and return the inferred type
 * rather than `unknown`, so the results are fully typed at the call site.
 *
 * Limitation: ephemeral registries contain exactly one schema — schemas that
 * resolve `$ref` to external IDs (e.g. BookSchema → IsbnSchema → …) will
 * throw `GraphError('REF_UNRESOLVED')` at runtime.  For multi-schema demos,
 * use `JsonTology.create({ schemas: [...] })` (instance form) instead.
 * This script uses self-contained schemas — `IsbnSchema` (a plain string
 * pattern) and an inline `RatingSchema` — that carry no external references.
 */

import { JsonTology } from '../src/index.js';
import { IsbnSchema } from '../examples/docs/bookstore/entities/Isbn.js';

// ---------------------------------------------------------------------------
// 1. JsonTology.validate — returns ValidationErrors (ok: true when valid)
// ---------------------------------------------------------------------------

const validIsbn = '9780525559474';
const invalidIsbn = 'not-an-isbn';

const validResult = JsonTology.validate(IsbnSchema, validIsbn);

console.log('validate (valid):', validResult.ok);             // true
console.log('validate (valid) errors:', validResult.length);  // 0

const invalidResult = JsonTology.validate(IsbnSchema, invalidIsbn);

console.log('validate (invalid):', invalidResult.ok);         // false
console.log('validate (invalid) errors:', invalidResult.length); // > 0

// ---------------------------------------------------------------------------
// 2. JsonTology.is — type-guard form
// ---------------------------------------------------------------------------

if (JsonTology.is(IsbnSchema, validIsbn)) {
  // narrowed to string (InferType<typeof IsbnSchema>)
  console.log('is(): valid ISBN confirmed:', validIsbn);
}

// ---------------------------------------------------------------------------
// 3. JsonTology.instantiate — validates and returns the typed value
// ---------------------------------------------------------------------------

const isbn = JsonTology.instantiate(IsbnSchema, validIsbn);

console.log('instantiate:', isbn); // '9780525559474' (typed as string)

// ---------------------------------------------------------------------------
// 4. JsonTology.materialize — synthesise defaults and return a typed instance
//    Uses an inline schema so we have a property with a default to demonstrate.
// ---------------------------------------------------------------------------

const RatingSchema = {
  '$id': 'urn:bookstore:_demo_Rating',
  'properties': {
    'label': {
      'default': 'unrated',
      'type': 'string'
    },
    'score': {
      'maximum': 5,
      'minimum': 1,
      'type': 'integer'
    }
  },
  'required': ['score'],
  'type': 'object'
} as const;

const rating = JsonTology.materialize(RatingSchema, { 'score': 4 });

console.log('materialize:', rating);
// { score: 4, label: 'unrated' } — default injected by materialize

// ---------------------------------------------------------------------------
// 5. JsonTology.toQuads — ABox projection → RDF quad array
//    Uses the object schema (RatingSchema) — primitive string schemas produce
//    no quads because there is no subject IRI to anchor the projection to.
// ---------------------------------------------------------------------------

const quads = JsonTology.toQuads(
  RatingSchema,
  { 'score': 4, 'label': 'excellent' },
  { 'iriFor': 'urn:bookstore:rating:001' }
);

console.log('toQuads count:', quads.length);

if (quads.length > 0) {
  const firstQuad = quads[0];
  if (firstQuad === undefined) {
    throw new Error('expected quad');
  }
  console.log('toQuads[0] subject:', firstQuad.subject);
  console.log('toQuads[0] predicate:', firstQuad.predicate);
}

// ---------------------------------------------------------------------------
// 6. Instance form — multi-schema registry for $ref resolution
//    Demonstrates the one-liner `JsonTology.create({ schemas: [...] })` form
//    when schemas reference each other.
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'schemas': [RatingSchema] as const
});

const instanceRating = jt.instantiate('urn:bookstore:_demo_Rating', { 'score': 3 });

console.log('instance.instantiate:', instanceRating);

// Confirm static and instance forms agree on the inferred type
const validatedByInstance = jt.validate('urn:bookstore:_demo_Rating', { 'score': 3 });

console.log('instance.validate ok:', validatedByInstance.ok);
