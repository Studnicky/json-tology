/**
 * Transform.brand — Example 1: Nominally distinct Customer vs Order IDs
 * Demonstrates: compile-time brand, BrandOutputType, coerce to obtain branded value
 *
 * Branded ID schemas register onto the canonical bookstore via
 * `jt.set()`. The two concrete IDs are the canonical
 * Bastian Balthazar Bux customer and order fixtures from their rare
 * Neverending Story purchase at Coreander's antiquariat.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

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

jt.set(BrandedCustomerIdSchema);
jt.set(BrandedOrderIdSchema);

// Both are strings at runtime — Bastian's customer + order UUIDs.
const cid = jt.instantiate(BrandedCustomerIdSchema, aboxFixtures.customer.id);
const oid = jt.instantiate(BrandedOrderIdSchema, aboxFixtures.order.id);

console.assert(typeof cid === 'string');
console.assert(typeof oid === 'string');
console.assert(cid === aboxFixtures.customer.id);
console.assert(oid === aboxFixtures.order.id);
// At compile time: CustomerId ≠ OrderId — type-level protection.
