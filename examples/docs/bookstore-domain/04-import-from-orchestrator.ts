/**
 * Bookstore domain: import from shared orchestrator
 *
 * All doc-page examples import from the shared orchestrator at
 * `examples/docs/bookstore/index.js`. This gives every guide page access
 * to the same pre-registered `bookstoreEntities`, the same schema
 * constants, the same ABox fixtures, and the same exported types.
 *
 * The path depth from guide example files is `../bookstore/index.js`.
 * From a new directory at the same level it is also `../bookstore/index.js`.
 */

import {
  aboxFixtures,
  bookstoreEntities,
  CustomerSchema
} from '../bookstore/index.js';

// bookstoreEntities is the shared registry — same instance across all guides.
const errs = bookstoreEntities.validate(
  CustomerSchema.$id,
  aboxFixtures.customer
);

console.assert(errs.length === 0);

const customerName: string = aboxFixtures.customer.name;

console.assert(customerName === 'Bastian Balthazar Bux');

console.log('shared registry size:', bookstoreEntities.registry.size);
console.log('customer validates against shared CustomerSchema, errors:', errs.length);
console.log('shared fixture name:', customerName);
