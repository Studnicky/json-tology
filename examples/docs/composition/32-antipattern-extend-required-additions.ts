/**
 * Compose.extend — Anti-pattern 1: New fields are NOT required
 *
 * `extend` inherits `required` from the base. Fields added in the
 * additions object stay optional unless they appear in the base's
 * required array. Use `Compose.intersection` if the added schema
 * needs its own required constraint to apply alongside the base.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// ✓ Do this — intersection layers a second required array onto the base.
const WithRequiredTierSchema = {
  '$id': 'https://bookstore.example/CustomerTierRequirement',
  'properties': { 'tier': { 'type': 'string' } },
  'required': ['tier'],
  'type': 'object'
} as const;

const CustomerWithRequiredTierSchema = Compose.intersection(
  [
    CustomerSchema,
    WithRequiredTierSchema
  ] as const,
  'https://bookstore.example/CustomerWithRequiredTier'
);

jt.set(WithRequiredTierSchema);
jt.set(CustomerWithRequiredTierSchema);

// Without tier, validation fails — the intersection requires it.
const missingTier = jt.validate(CustomerWithRequiredTierSchema.$id, {
  'addresses': [],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
});

console.assert(!missingTier.ok);
