/**
 * Round-trip a customer through quads
 *
 * Use fromQuads to lift RDF quads back into typed JS objects.
 * Inverse of toQuads.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customerData = {
  'addresses': [{
    'city': 'München',
    'postalCode': '80538',
    'street': 'Reichenbachstraße 14'
  }],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
};

// Project to quads — toQuads returns QuadInterface[] directly
const abox = bookstoreEntities.toQuads(CustomerSchema, customerData);

// Lift back to typed objects — use the string key form for full type inference
const customers = bookstoreEntities.fromQuads(CustomerSchema.$id, abox);
// customers: Customer[] — each element validated through coerce

console.assert(Array.isArray(customers), 'customers is array');
console.assert(customers.length > 0, 'at least one customer');
console.assert(customers[0].name === 'Bastian Balthazar Bux', 'name preserved');

console.log('Round-trip: toQuads quad count:', abox.length);
console.log('Round-trip: fromQuads customer count:', customers.length);
console.log('Recovered customer name:', customers[0].name);
