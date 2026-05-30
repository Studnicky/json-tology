/**
 * value.create — Example 2: Blank Customer for testing
 * Demonstrates: zero-values for all required fields, addresses default []
 *
 * Creates a blank Customer instance — every string field gets '' and the
 * addresses array gets its declared default []. Useful for pre-populating
 * form initial state without requiring test fixture data.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const blankCustomer = bookstoreEntities.value.create(CustomerSchema.$id) as Record<string, unknown>;

// Required string fields get zero-values.
console.assert((blankCustomer as { 'customerId': string }).customerId === '');
console.assert((blankCustomer as { 'email': string }).email === '');
console.assert((blankCustomer as { 'name': string }).name === '');

// addresses has a declared default of [] — applied here.
console.assert(Array.isArray((blankCustomer as { 'addresses': unknown[] }).addresses));
console.assert((blankCustomer as { 'addresses': unknown[] }).addresses.length === 0);

console.log('blank customerId:', (blankCustomer as { 'customerId': string }).customerId);
console.log('blank email:', (blankCustomer as { 'email': string }).email);
console.log('blank addresses:', (blankCustomer as { 'addresses': unknown[] }).addresses);
