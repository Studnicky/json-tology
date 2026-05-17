/**
 * Project a customer to ABox quads
 *
 * toQuads returns QuadInterface[] — use the array directly to emit RDF
 * individuals for storage or reasoner input.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// toQuads returns QuadInterface[] — use the array directly
const abox = bookstoreEntities.toQuads(CustomerSchema, {
  'addresses': [{
    'city': 'München',
    'postalCode': '80538',
    'street': 'Reichenbachstraße 14'
  }],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
});

// abox is QuadInterface[] — iterate, filter, or pass to OntologyBuilder
console.assert(abox.length > 0, 'quads generated');
console.assert(abox[0], 'first quad present');
