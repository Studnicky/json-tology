/**
 * Open-world assumption — schemas constrain, not enumerate.
 *
 * JSON Schema (and json-tology) follow the open-world assumption (OWA): a
 * schema defines what is required and constrained, not what is exhaustively
 * allowed. Additional properties are permitted unless `additionalProperties`
 * or `jt:config.extra` explicitly restricts them.
 *
 * CustomerSchema requires `id`, `email`, and `name` but does not forbid
 * additional properties by default. An instance with an extra `loyaltyTier`
 * field still validates.
 *
 * Demonstrates: OWA — extra properties pass by default; additional field
 * does not cause validation failure.
 */

import {
  bookstoreEntities,
  CustomerSchema
} from '../bookstore/index.js';

// Valid: includes all required fields
const baseCustomer = {
  'addresses': [],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
};

const baseResult = bookstoreEntities.validate(CustomerSchema.$id, baseCustomer);

// ok is true when the ValidationErrors collection is empty (no errors)
console.assert(baseResult.ok, 'base customer is valid');

// OWA: extra property `loyaltyTier` is allowed (no additionalProperties: false)
const extendedCustomer = {
  ...baseCustomer,
  // unknown to the schema — allowed by OWA
  'loyaltyTier': 'gold'
};

const extendedResult = bookstoreEntities.validate(CustomerSchema.$id, extendedCustomer);

// Under OWA the extra property does not cause a validation failure
console.assert(extendedResult.ok, 'extra property is allowed under open-world assumption');

console.log('OWA: base valid:', baseResult.ok, '| with extra property:', extendedResult.ok);
