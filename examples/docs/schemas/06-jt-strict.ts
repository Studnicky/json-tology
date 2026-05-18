/**
 * jt:strict — Example 6: per-schema strict-types override
 *
 * `jt:strict: true` opts a single schema into strict-types mode even
 * when the global `enableStrictTypes` is `false`. A schema with this
 * keyword rejects string-to-number coercions and null for typed fields,
 * while other schemas in the same registry remain lenient.
 *
 * Use this on wire-facing payloads where silent coercion would mask
 * upstream bugs.
 */

import { JsonTology } from '../../../src/index.js';

const StrictIsbnSchema = {
  '$id': 'urn:docs-schemas-06:StrictIsbn',
  // reject coercions for this schema only
  'jt:strict': true,
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'price': {
      'exclusiveMinimum': 0,
      'type': 'number'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'price'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'urn:docs-schemas-06',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  // global: lenient
  'enableStrictTypes': false,
  'schemas': [StrictIsbnSchema] as const
});

// Correct types — passes.
const errsOk = jt.validate(StrictIsbnSchema.$id, {
  'isbn': '9783522128001',
  'price': 850,
  'title': 'Die unendliche Geschichte'
});

console.assert(errsOk.length === 0);

// String price on a jt:strict schema — fails even though global is lenient.
const errsStrict = jt.validate(StrictIsbnSchema.$id, {
  'isbn': '9783522128001',
  'price': '850',
  'title': 'Die unendliche Geschichte'
});

console.assert(errsStrict.length > 0);
