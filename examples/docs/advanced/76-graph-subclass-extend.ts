/**
 * Specificity and rdfs:subClassOf — Compose.extend produces a subclass.
 *
 * `Compose.extend(parent, additions)` produces an `allOf + $ref` schema: the
 * parent is referenced via `$ref` and the additions live in a second `allOf`
 * member. The OWL projection emits `rdfs:subClassOf` for the extended schema.
 *
 * The new `PremiumCustomer` subclass registers onto the canonical
 * `bookstoreEntities` registry so it inherits every existing
 * transitive `$ref` (Email, Address, …).
 *
 * Demonstrates: Compose.extend on CustomerSchema to model a PremiumCustomer
 * subclass; TBox JSON-LD carries both class IRIs.
 */

import { Compose } from '../../../src/index.js';
import {
  bookstoreEntities,
  CustomerSchema
} from '../bookstore/index.js';

// PremiumCustomer extends Customer with a `tier` property.
const PremiumCustomerSchema = Compose.extend(
  CustomerSchema,
  {
    'properties': {
      'tier': {
        'enum': [
          'gold',
          'platinum'
        ],
        'type': 'string'
      }
    },
    'required': ['tier']
  } as const,
  'urn:bookstore:PremiumCustomer'
);

// Capture the widened instance so PremiumCustomer is a known `$id` key — the
// precise string-id `validate` form resolves it without re-checking the
// `Compose.extend` schema object against the document-type constraint.
const withPremium = bookstoreEntities.set(PremiumCustomerSchema);

// Both classes appear in the TBox.
const tboxJson = bookstoreEntities.toTbox().jsonLd();

console.assert(tboxJson.includes(CustomerSchema.$id), 'Customer class in TBox');
console.assert(
  tboxJson.includes(PremiumCustomerSchema.$id),
  'PremiumCustomer subclass in TBox'
);

// A valid PremiumCustomer validates against its own schema.
const result = withPremium.validate(PremiumCustomerSchema.$id, {
  'addresses': [],
  'customerId': 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
  'email': 'cornelia.funke@bookstore.example',
  'name': 'Cornelia Funke',
  'tier': 'gold'
});

// ok is true when the ValidationErrors collection is empty (no errors).
console.assert(result.ok, 'valid PremiumCustomer passes validation');

console.log('Customer in TBox:', tboxJson.includes(CustomerSchema.$id), '| PremiumCustomer subclass valid:', result.ok);
