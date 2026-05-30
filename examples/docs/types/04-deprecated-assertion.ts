/**
 * DeprecatedKeysType — Example 2: Compile-time assertion that a key is deprecated
 *
 * Demonstrates using DeprecatedKeysType to assert at compile time whether
 * a particular property is marked deprecated in a schema.
 */

import type { DeprecatedKeysType } from '../../../src/types/index.js';

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

type DeprecatedBookKeys = DeprecatedKeysType<typeof _BookV1Schema>;
// 'legacySku'

// Compile-time guard - narrows to never if the key is not deprecated.
// OK: 'legacySku' is in DeprecatedBookKeys
const deprecatedKey: DeprecatedBookKeys = 'legacySku';

console.log('DeprecatedKeysType<BookV1Schema>:', deprecatedKey, '(only key with deprecated: true)');
