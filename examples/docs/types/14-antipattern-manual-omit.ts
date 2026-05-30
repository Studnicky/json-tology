/**
 * Anti-pattern: Manual `Omit` with a string literal.
 *
 * Hand-typing the keys to omit drifts the moment another property is
 * marked `deprecated: true`. The schema knows which keys are
 * deprecated — let `NonDeprecatedSchemaType<T>` derive the filtered
 * shape from it.
 */

import type {
  InferType, NonDeprecatedSchemaType
} from '../../../src/types/index.js';

const _BookV1Schema = {
  '$id': 'https://bookstore.example/BookV1',
  'properties': {
    'isbn': { 'type': 'string' },
    'legacySku': {
      'deprecated': true,
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title'
  ],
  'type': 'object'
} as const;

// ⊥ Don't do this — the Omit list goes stale on the next deprecation.
type BookV1ManualCurrent = Omit<InferType<typeof _BookV1Schema>, 'legacySku'>;

// ✓ Do this — derived from the schema; new deprecations propagate.
type BookV1Current = NonDeprecatedSchemaType<typeof _BookV1Schema>;

const fresh: BookV1Current = {
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
};
const manual: BookV1ManualCurrent = fresh;

console.assert(manual.isbn === fresh.isbn);

console.log('NonDeprecatedSchemaType keys:', Object.keys(fresh).join(', '));
console.log('both shapes have same isbn:', manual.isbn === fresh.isbn, '(derived form auto-tracks future deprecations)');
