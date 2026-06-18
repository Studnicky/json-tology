/**
 * JsonTology.create — Example 8: register multiple schemas at once
 *
 * `JsonTology.create` takes a `schemas` array (as const) and a `baseIri`.
 * All schemas are registered, the validation graph is compiled, and the
 * type map is built. `$ref` resolution works because all referenced
 * schemas are registered in the same call.
 */

import {
  AddressSchema,
  BookSchema,
  bookstoreEntities,
  CustomerSchema
} from '../bookstore/index.js';

// bookstoreEntities was created with all 31 schemas pre-registered.
// Validate a concrete address — if AddressSchema is not registered
// the call would throw REF_UNRESOLVED, so zero errors proves presence.
const addressErrs = bookstoreEntities.validate(AddressSchema.$id, {
  'city': 'München',
  'country': 'DE',
  'postalCode': '80331',
  'street': 'Reichenbachstraße 14'
});

console.assert(addressErrs.length === 0);

// Validate the canonical fixtures to confirm the other schemas are registered.
const customerErrs = bookstoreEntities.validate(CustomerSchema.$id, {
  'addresses': [],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
});

console.assert(customerErrs.length === 0);

const bookErrs = bookstoreEntities.validate(BookSchema.$id, {
  'authors': ['Michael Ende'],
  'inStock': true,
  'isbn': '9783522128001',
  'price': {
    'amount': 850,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint',
  'publishedOn': '1979-09-01',
  'stockLevel': 5,
  'title': 'Die unendliche Geschichte'
});

console.assert(bookErrs.length === 0);

console.log('AddressSchema.$id:', AddressSchema.$id, '— address validation errors:', addressErrs.length);
console.log('CustomerSchema.$id:', CustomerSchema.$id, '— customer validation errors:', customerErrs.length);
console.log('BookSchema.$id:', BookSchema.$id, '— book validation errors:', bookErrs.length);
console.log('All three schemas registered in bookstoreEntities — cross-schema $ref resolution active.');
