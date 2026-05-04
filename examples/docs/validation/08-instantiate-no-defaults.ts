/**
 * Validation Example 08 — coerce with enableDefaults: false
 * Demonstrates: per-call opt-out of default-filling for PATCH semantics
 */

import { JsonTology } from '../../../src/index.js';
import {
  AddressSchema, CustomerNameSchema, CustomerSchema
} from '../bookstore/index.js';

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AddressSchema,
    CustomerNameSchema,
    CustomerSchema
  ] as const
});

// Full coerce — fills defaults including addresses: []
const full = jt.instantiate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
}) as Record<string, unknown>;

console.log('Full coerce (addresses default filled):', Array.isArray(full.addresses) && full.addresses.length === 0);

// Patch coerce — missing fields stay missing (no defaults filled)
const patch = jt.instantiate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
}, { 'enableDefaults': false }) as Record<string, unknown>;

console.log('Patch coerce (addresses not filled):', patch.addresses === undefined);
