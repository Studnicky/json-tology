/**
 * Anti-pattern: Manual string union for deprecated keys.
 *
 * Hand-rolling the union of deprecated property names drifts from the
 * schema the moment a second field is marked deprecated. Use
 * `DeprecatedKeysType<T>` instead — it stays in sync with the schema
 * literal at compile time.
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

// ⊥ Don't do this — manual string union drifts from the schema.
type DeprecatedBookKeysManual = 'legacySku';

// ✓ Do this — derived from the schema literal, stays in sync.
type DeprecatedBookKeysCorrect = DeprecatedKeysType<typeof _BookV1Schema>;

// Both happen to resolve to 'legacySku' today, but only the derived
// form survives a second `deprecated: true` annotation tomorrow.
const manualKey: DeprecatedBookKeysManual = 'legacySku';
const derivedKey: DeprecatedBookKeysCorrect = 'legacySku';

console.log('manual union:', manualKey, '(drifts if schema changes)');
console.log('derived union:', derivedKey, '(stays in sync with schema literal)');
