/**
 * is — Example 1: Type narrowing in a conditional branch
 * Demonstrates: boolean type guard, TypeScript narrowing
 */

import {
  bookstoreJt, type Customer, CustomerSchema
} from '../bookstore/index.js';

function describeCustomer(data: unknown): string {
  if (bookstoreJt.is(CustomerSchema.$id, data)) {
    // data is narrowed to Customer here
    return `${String(data.name)} <${String(data.email)}>`;
  }

  return 'not a customer';
}

const result = describeCustomer({
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
});

console.assert(result === 'Alice Chen <alice@bookstore.example>');

const invalid = describeCustomer({ 'email': 'bad' });

console.assert(invalid === 'not a customer');

// Array filtering
const mixed: unknown[] = [
  {
    'email': 'alice@bookstore.example',
    'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
    'name': 'Alice'
  },
  { 'foo': 'bar' },
  {
    'email': 'bob@bookstore.example',
    'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'name': 'Bob'
  }
];

const customers = mixed.filter((item): item is Customer => {
  return bookstoreJt.is(CustomerSchema.$id, item);
});

console.assert(customers.length === 2);
