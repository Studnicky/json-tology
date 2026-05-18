/**
 * Anti-pattern: Reaching for `Omit<…, DeprecatedKeysType<T>>` when
 * `NonDeprecatedSchemaType<T>` is the right tool.
 *
 * `DeprecatedKeysType<T>` gives you the key names. If what you actually
 * want is the filtered object shape, ask for it directly with
 * `NonDeprecatedSchemaType<T>` — it composes the same `Omit` for you
 * and propagates the schema's deep inference rules.
 */

import type {
  DeprecatedKeysType, InferType, NonDeprecatedSchemaType
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

// ⊥ Don't do this — you want the filtered type, not just the key names.
type SafeBookHandRolled = Omit<
  InferType<typeof _BookV1Schema>,
  DeprecatedKeysType<typeof _BookV1Schema>
>;

// ✓ Do this — single utility expresses intent.
type SafeBook = NonDeprecatedSchemaType<typeof _BookV1Schema>;

// Both resolve to the same object shape today.
const sample: SafeBook = {
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
};
const sampleAlt: SafeBookHandRolled = sample;

console.assert(sampleAlt.isbn === '9783522128001');
