/**
 * Validation Example 08 — coerce with enableDefaults: false
 * Demonstrates: per-call opt-out of default-filling for PATCH semantics
 *
 * Uses the canonical Bastian Balthazar Bux customer fixture against the
 * canonical bookstore registry — no mini-registry.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Full coerce — fills defaults including addresses: [].
const full = bookstoreEntities.instantiate(CustomerSchema.$id, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
}) as Record<string, unknown>;

console.assert(Array.isArray(full.addresses) && (full.addresses as unknown[]).length === 0);

// Patch coerce — missing fields stay missing (no defaults filled).
const patch = bookstoreEntities.instantiate(CustomerSchema.$id, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
}, { 'enableDefaults': false }) as Record<string, unknown>;

console.assert(patch.addresses === undefined);
