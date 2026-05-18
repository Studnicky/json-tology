/**
 * is — Example 1: Type narrowing in a conditional branch
 * Demonstrates: is() narrows data to Customer inside the if block
 *
 * Walter Moers as a valid customer; a plain string as an invalid one.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

function describeCustomer(data: unknown): string {
  if (bookstoreEntities.is(CustomerSchema, data)) {
    // data is narrowed to Customer here
    return `${String(data.name)} <${String(data.email)}>`;
  }

  return 'not a customer';
}

const valid = {
  'addresses': [],
  'email': 'walter.moers@bookstore.example',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Walter Moers'
};

console.assert(describeCustomer(valid) === 'Walter Moers <walter.moers@bookstore.example>');
console.assert(describeCustomer('not-a-customer') === 'not a customer');
console.assert(describeCustomer(null) === 'not a customer');
