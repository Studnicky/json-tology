/**
 * DefaultAlignedType — Example 1: A well-aligned schema passes through.
 *
 * Every property with a `default` carries a value whose type matches
 * the declared `type`. DefaultAlignedType resolves to the schema type
 * unchanged.
 */

import type { DefaultAlignedType } from '../../../src/types/index.js';

const _BookSchema = {
  '$id': 'https://bookstore.example/Book',
  'properties': {
    'currency': {
      'default': 'USD',
      'type': 'string'
    },
    'inStock': {
      'default': true,
      'type': 'boolean'
    },
    'price': {
      'exclusiveMinimum': 0,
      'type': 'number'
    }
  },
  'required': ['price'],
  'type': 'object'
} as const;

type AlignedBook = DefaultAlignedType<typeof _BookSchema>;
// typeof _BookSchema — the schema passes through.

const aligned: AlignedBook = _BookSchema;

// The schema resolves to AlignedBook (the schema literal itself) because
// every default matches its declared type: 'USD' is a string, true is boolean.
console.log('schema $id:', aligned.$id);
console.log('currency default:', aligned.properties.currency.default);
console.log('inStock default:', aligned.properties.inStock.default);
