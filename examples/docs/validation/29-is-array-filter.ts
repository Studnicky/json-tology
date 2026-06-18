/**
 * is — Example 2: Filtering an array of unknowns
 * Demonstrates: type-predicate filter — result is Customer[]
 *
 * Mixed array of valid and invalid items; only the valid Customer objects pass.
 */

import {
  bookstoreEntities, type Customer, CustomerSchema
} from '../bookstore/index.js';

// instantiate validates the raw input against the branded schema and returns
// the branded Customer value — a plain object literal lacks the format/length
// brands the type carries.
const validCustomer: Customer = bookstoreEntities.instantiate(CustomerSchema.$id, {
  'addresses': [],
  'customerId': 'b2c3d4e5-f6a7-4901-8def-012345678901',
  'email': 'cornelia.funke@bookstore.example',
  'name': 'Cornelia Funke'
});

const mixed: unknown[] = [
  validCustomer,
  { 'email': 'not-a-customer' },
  42,
  null,
  {
    'addresses': [],
    'customerId': 'c3d4e5f6-a7b8-4012-9efa-123456789012',
    'email': 'patrick.suskind@bookstore.example',
    'name': 'Patrick Süskind'
  }
];

const customers = mixed.filter((item): item is Customer => {
  return bookstoreEntities.is(CustomerSchema.$id, item);
});

// customers is Customer[]
console.assert(customers.length === 2);
const firstCustomer = customers[0];
const secondCustomer = customers[1];

if (firstCustomer === undefined || secondCustomer === undefined) {
  throw new Error('expected two customers');
}
console.assert(firstCustomer.name === 'Cornelia Funke');
console.assert(secondCustomer.name === 'Patrick Süskind');

console.log('filtered customers:', customers.map((customer) => {
  return customer.name;
}));
