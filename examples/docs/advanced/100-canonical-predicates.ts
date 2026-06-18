/**
 * Canonical (flat) vs legacy (class-scoped) predicate IRIs.
 *
 * By default (`enableCanonicalPredicates: true`, the default), `toQuads`
 * emits flat predicates derived from the registry `baseIri`:
 *
 *   https://bookstore.example/name
 *   https://bookstore.example/email
 *
 * Passing `enableCanonicalPredicates: false` restores the legacy
 * class-scoped form where each class owns its own predicate namespace:
 *
 *   urn:bookstore:Customer#name
 *   urn:bookstore:Customer#email
 *
 * The canonical form is shared across all classes that carry the same
 * property name — the predicate is vocabulary-wide, not per-class. The
 * legacy form is useful when migrating a codebase that already uses
 * class-scoped IRIs in a triple store or reasoner.
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures,
  bookstoreSchemas,
  CustomerSchema
} from '../bookstore/index.js';

// ── Default: canonical flat predicates ────────────────────────────────────
const canonicalJt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'enableCanonicalPredicates': true,
  'schemas': bookstoreSchemas
});

// Use a validated instance so the branded types are satisfied.
const customer = canonicalJt.instantiate(CustomerSchema, aboxFixtures.customer);
const canonicalQuads = canonicalJt.toQuads(CustomerSchema, customer);

const canonicalPredicates = canonicalQuads.map((quad) => {
  return quad.predicate.value;
});

// Flat: shared across all classes — every 'name' or 'email' in the vocabulary uses this predicate.
console.assert(
  canonicalPredicates.some((predicate) => {
    return predicate === 'https://bookstore.example/name';
  }),
  'canonical: name predicate is flat https://bookstore.example/name'
);
console.assert(
  canonicalPredicates.some((predicate) => {
    return predicate === 'https://bookstore.example/email';
  }),
  'canonical: email predicate is flat https://bookstore.example/email'
);

console.log('Canonical predicates (sample):');
const canonicalSorted = [...new Set(canonicalPredicates)].sort();

for (const predicate of canonicalSorted) {
  console.log(' ', predicate);
}

// ── Opt-out: legacy class-scoped predicates ───────────────────────────────
const legacyJt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'enableCanonicalPredicates': false,
  'schemas': bookstoreSchemas
});

const legacyCustomer = legacyJt.instantiate(CustomerSchema, aboxFixtures.customer);
const legacyQuads = legacyJt.toQuads(CustomerSchema, legacyCustomer);

const legacyPredicates = legacyQuads.map((quad) => {
  return quad.predicate.value;
});

// Class-scoped: the class ID becomes the namespace, property name the local part.
console.assert(
  legacyPredicates.some((predicate) => {
    return predicate.includes('#name');
  }),
  'legacy: name predicate contains #name fragment'
);
console.assert(
  legacyPredicates.some((predicate) => {
    return predicate.includes('#email');
  }),
  'legacy: email predicate contains #email fragment'
);

console.log('\nLegacy predicates (sample):');
const legacySorted = [...new Set(legacyPredicates)].sort();

for (const predicate of legacySorted) {
  console.log(' ', predicate);
}
