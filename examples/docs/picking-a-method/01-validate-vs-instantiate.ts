/**
 * Picking a method: validate vs instantiate
 *
 * Demonstrates: validate returns errors (no throw), instantiate throws or returns coerced value
 * Uses the canonical bookstore fixtures.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Valid order — instantiate returns coerced value
const validOrder = bookstoreEntities.instantiate(OrderSchema.$id, aboxFixtures.order);

console.assert(validOrder.id === aboxFixtures.order.id);
console.assert(validOrder.customerId === aboxFixtures.order.customerId);

// Invalid order — tamper one field
const invalidOrder = {
  ...aboxFixtures.order,
  // Required field, not nullable.
  'customerId': null
};

// Try instantiate on invalid data — throws InstantiationError
let caught = false;

try {
  bookstoreEntities.instantiate(OrderSchema.$id, invalidOrder);
} catch (error) {
  caught = true;
  console.assert(error.name === 'InstantiationError');
}

console.assert(caught);
