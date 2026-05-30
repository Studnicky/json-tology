/**
 * Explicit per-property predicate via `x-jt-predicate`.
 *
 * Adding `x-jt-predicate: '<IRI>'` directly to a property schema pins
 * that property to a specific predicate IRI regardless of the registry
 * `baseIRI`, `enableCanonicalPredicates`, or `predicateFor` settings.
 * It is the highest-precedence predicate binding — only the property
 * `$id` (when it is an absolute IRI) takes precedence over it.
 *
 * Use `x-jt-predicate` when a single property must align to an external
 * vocabulary IRI without touching the registry-level `predicateFor`
 * callback.
 */

import { JsonTology } from '../../../src/index.js';

// A minimal schema that pins `isbn` to the Schema.org ISBN predicate.
const BookSchema = {
  '$id': 'https://bookstore.example/Book',
  'properties': {
    'isbn': {
      '$ref': 'https://bookstore.example/Isbn',
      'x-jt-predicate': 'https://schema.org/isbn'
    },
    'title': { '$ref': 'https://bookstore.example/Title' }
  },
  'required': [
    'isbn',
    'title'
  ],
  'type': 'object'
} as const;

const IsbnSchema = {
  '$id': 'https://bookstore.example/Isbn',
  'type': 'string'
} as const;

const TitleSchema = {
  '$id': 'https://bookstore.example/Title',
  'type': 'string'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [
    IsbnSchema,
    TitleSchema,
    BookSchema
  ] as const
});

const quads = jt.toQuads(BookSchema, {
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
});

const predicates = quads.map((quad) => {
  return quad.predicate.value;
});

// isbn uses the pinned Schema.org predicate — not the flat canonical form.
console.assert(
  predicates.some((predicate) => {
    return predicate === 'https://schema.org/isbn';
  }),
  'isbn emitted as https://schema.org/isbn (x-jt-predicate)'
);

// title uses the default flat canonical form (no x-jt-predicate set).
console.assert(
  predicates.some((predicate) => {
    return predicate === 'https://bookstore.example/title';
  }),
  'title emitted as https://bookstore.example/title (default canonical)'
);

console.log('Predicates emitted:');
for (const predicate of [...new Set(predicates)].sort()) {
  console.log(' ', predicate);
}
