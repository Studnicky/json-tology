/**
 * jt:alias — Example 2: alternative IRIs for a schema class
 *
 * `jt:alias` records alternative IRIs for the schema's owning class.
 * When the bookstore domain publishes RDF, `BookSchema` carries an alias
 * pointing to the schema.org Book class so external consumers can map
 * the canonical IRI to the wider vocabulary.
 *
 * The alias surfaces as `owl:equivalentClass` or `skos:altLabel` in TBox
 * output, depending on active vocabulary plugins. At runtime, `jt:alias`
 * is only metadata — it has no effect on `validate` or `instantiate`.
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// BookSchema carries jt:alias so the canonical graph node records
// alternative IRIs. The schema is otherwise a normal registered schema.
const errs = bookstoreEntities.validate(BookSchema.$id, {
  'authors': ['Michael Ende'],
  'inStock': true,
  'isbn': '9783522128001',
  'price': {
    'amount': 850,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint',
  'publishedOn': '1979-09-01',
  'stockLevel': 5,
  'title': 'Die unendliche Geschichte'
});

// Validation is independent of alias metadata.
console.assert(errs.length === 0);

// The $id is always the canonical IRI — aliases do not change identity.
const canonicalId: string = BookSchema.$id;

console.assert(canonicalId === 'urn:bookstore:Book');

console.log('BookSchema.$id:', canonicalId);
console.log('Validation errors (expect 0):', errs.length);
console.log('jt:alias does not affect validation — validation errors are zero regardless of alias metadata.');
