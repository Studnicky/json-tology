/**
 * dumpJson against the canonical Customer — Example
 *
 * `dumpJson` round-trips a registered Customer through the canonical
 * registry to its wire-form JSON. The Bastian-orders-Neverending-Story
 * fixture is the input.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.instantiate(CustomerSchema.$id, aboxFixtures.customer);
const wire = bookstoreEntities.dumpJson(CustomerSchema.$id, customer);

console.assert(typeof wire === 'string' && wire.length > 0);
console.assert(wire.includes('Bastian Balthazar Bux'));
