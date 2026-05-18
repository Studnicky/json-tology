/**
 * instantiate — Per-call option: validate without filling defaults
 * Demonstrates: enableDefaults: false for PATCH semantics
 *
 * On a PATCH endpoint, missing fields mean "no change" rather than
 * "apply schema default". Hermann Hesse sends a name-only update;
 * addresses must stay missing, not be filled with the schema default [].
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const incomingPatchBody = {
  'email': 'hermann.hesse@bookstore.example',
  'id': 'a2b3c4d5-e6f7-8901-bcde-f12345678901',
  // addresses intentionally absent — PATCH means "don't change"
  'name': 'Hermann Hesse'
};

const patched = bookstoreEntities.instantiate(
  CustomerSchema,
  incomingPatchBody,
  // missing fields stay missing
  { 'enableDefaults': false }
);

console.assert(patched.name === 'Hermann Hesse');

// With enableDefaults: false, addresses is not filled with the default []
// Cast to unknown first to avoid false type-overlap errors at the property check
const patchedRecord = patched as Record<string, unknown>;

console.assert(
  !('addresses' in patchedRecord) || patchedRecord.addresses === undefined,
  'addresses should not be default-filled on a PATCH call'
);
