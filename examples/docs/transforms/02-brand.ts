/**
 * Transform.brand — Example 1: Nominally distinct Customer vs Order IDs
 * Demonstrates: compile-time brand, BrandOutputType, coerce to obtain branded value
 *
 * Branded ID schemas register onto the canonical bookstore via
 * `bookstoreEntities.set()`. The two concrete IDs are the canonical
 * Bastian Balthazar Bux customer and order fixtures from their rare
 * Neverending Story purchase at Coreander's antiquariat.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities
} from '../bookstore/index.js';

const BrandedCustomerIdSchema = Transform.brand(
  {
    '$id': 'https://bookstore.example/BrandedCustomerId',
    'format': 'uuid',
    'type': 'string'
  } as const,
  'CustomerId'
);

const BrandedOrderIdSchema = Transform.brand(
  {
    '$id': 'https://bookstore.example/BrandedOrderId',
    'format': 'uuid',
    'type': 'string'
  } as const,
  'OrderId'
);

bookstoreEntities.set(BrandedCustomerIdSchema);
bookstoreEntities.set(BrandedOrderIdSchema);

// Both are strings at runtime — Bastian's customer + order UUIDs.
const cid = bookstoreEntities.instantiate(BrandedCustomerIdSchema.$id, aboxFixtures.customer.id);
const oid = bookstoreEntities.instantiate(BrandedOrderIdSchema.$id, aboxFixtures.order.id);

console.assert(typeof cid === 'string');
console.assert(typeof oid === 'string');
console.assert(cid === aboxFixtures.customer.id);
console.assert(oid === aboxFixtures.order.id);
// At compile time: CustomerId ≠ OrderId — type-level protection.
