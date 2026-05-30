/**
 * Operations.clone — Example 2: Clone nested addresses
 * Demonstrates: deep copy preserves independence of nested arrays
 *
 * Bastian Balthazar Bux's customer record has a nested addresses array.
 * After cloning, the addresses array in the copy is a distinct object —
 * mutations to the copy do not affect the original.
 */

import {
  Operations
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.instantiate(CustomerSchema.$id, aboxFixtures.customer);

const copy = Operations.clone(customer);

// Deep copy — arrays are distinct references.
const custAddresses = (customer as Record<string, unknown>).addresses;
const copyAddresses = (copy as Record<string, unknown>).addresses;

console.assert(copyAddresses !== custAddresses);
console.assert(Array.isArray(copyAddresses));
console.assert((copy as { 'name': string }).name === aboxFixtures.customer.name);

console.log('copy.name:', (copy as { 'name': string }).name);
console.log('addresses are distinct references:', copyAddresses !== custAddresses);
