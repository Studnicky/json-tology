/**
 * is — Example 2: Filtering an array of unknowns
 * Demonstrates: type-predicate filter — result is Customer[]
 *
 * Mixed array of valid and invalid items; only the valid Customer objects pass.
 */

import {
  bookstoreEntities, type Customer, CustomerSchema
} from '../bookstore/index.js';

const validCustomer: Customer = {
  'addresses': [],
  'email': 'cornelia.funke@bookstore.example',
  'id': 'b2c3d4e5-f6a7-4901-8def-012345678901',
  'name': 'Cornelia Funke'
};

const mixed: unknown[] = [
  validCustomer,
  { 'email': 'not-a-customer' },
  42,
  null,
  {
    'addresses': [],
    'email': 'patrick.suskind@bookstore.example',
    'id': 'c3d4e5f6-a7b8-4012-9efa-123456789012',
    'name': 'Patrick Süskind'
  }
];

const customers = mixed.filter((item): item is Customer => {
  return bookstoreEntities.is(CustomerSchema.$id, item);
});

// customers is Customer[]
console.assert(customers.length === 2);
console.assert(customers[0].name === 'Cornelia Funke');
console.assert(customers[1].name === 'Patrick Süskind');
