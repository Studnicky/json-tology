/**
 * is — Example 1: Type narrowing in a conditional branch
 * Demonstrates: boolean type guard, TypeScript narrowing
 *
 * Customers drawn from The Neverending Story framing cast: Bastian
 * Balthazar Bux (canonical fixture) and Carl Conrad Coreander, the
 * antiquariat owner — both are customers of the modern bookstore.
 */

import {
  aboxFixtures, bookstoreEntities, type Customer, CustomerSchema
} from '../bookstore/index.js';

function describeCustomer(data: unknown): string {
  if (bookstoreEntities.is(CustomerSchema, data)) {
    // data is narrowed to Customer here
    return `${String(data.name)} <${String(data.email)}>`;
  }

  return 'not a customer';
}

const result = describeCustomer({
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
});

console.assert(result === `${aboxFixtures.customer.name} <${aboxFixtures.customer.email}>`);

const invalid = describeCustomer({ 'email': 'bad' });

console.assert(invalid === 'not a customer');

// Array filtering: Bastian and Coreander both pass; the bare {foo:bar} does not.
const mixed: unknown[] = [
  {
    'email': aboxFixtures.customer.email,
    'id': aboxFixtures.customer.id,
    'name': aboxFixtures.customer.name
  },
  { 'foo': 'bar' },
  {
    'email': 'carl.coreander@bookstore.example',
    'id': 'b2c3d4e5-f6a7-4901-9cde-f12345678901',
    'name': 'Carl Conrad Coreander'
  }
];

const customers = mixed.filter((item): item is Customer => {
  return bookstoreEntities.is(CustomerSchema, item);
});

console.assert(customers.length === 2);
console.assert(customers[1].name === 'Carl Conrad Coreander');
