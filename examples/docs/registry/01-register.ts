/**
 * register / has / get / list — Example 1: Registry lifecycle
 * Demonstrates: post-construction register, has/get inspection, registerAnonymous
 *
 * Operates against the canonical bookstore registry. The canonical
 * entities (Customer, Book, …) are already registered at construction
 * time; this example layers a GiftCertificate schema on top to show
 * post-hoc registration.
 */

import {
  BookSchema, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Canonical entities registered at construction time.
console.assert(bookstoreEntities.registry.has(CustomerSchema.$id));
console.assert(bookstoreEntities.registry.has(BookSchema.$id));

// Post-construction register — a gift certificate Carl Conrad Coreander
// offers for purchases at the antiquariat.
const CoreanderGiftCertificateSchema = {
  '$id': 'https://bookstore.example/CoreanderGiftCertificate',
  'properties': {
    'code': { 'type': 'string' },
    'value': {
      'maximum': 10_000,
      'minimum': 0,
      'type': 'number'
    }
  },
  'required': [
    'code',
    'value'
  ],
  'type': 'object'
} as const;

console.assert(!bookstoreEntities.registry.has(CoreanderGiftCertificateSchema.$id));

bookstoreEntities.set(CoreanderGiftCertificateSchema);

console.assert(bookstoreEntities.registry.has(CoreanderGiftCertificateSchema.$id));

// Retrieve the schema object.
const raw = bookstoreEntities.registry.get(CoreanderGiftCertificateSchema.$id);

console.assert(raw !== undefined);

// registerAnonymous — no $id needed. Useful for ad-hoc input shapes,
// e.g. a one-off "BastianCheckoutPayload" the storefront posts.
const syntheticId = bookstoreEntities.registerAnonymous({
  'properties': {
    'certificateCode': { 'type': 'string' },
    'remainingBalance': { 'type': 'number' }
  },
  'required': [
    'certificateCode',
    'remainingBalance'
  ],
  'type': 'object'
});

console.assert(typeof syntheticId === 'string' && syntheticId.length > 0);
console.assert(bookstoreEntities.registry.has(syntheticId));
