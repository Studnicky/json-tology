/**
 * Transform.brand — Example 1: Nominally distinct Customer and Order IDs
 * Demonstrates: BrandOutputType, compile-time incompatibility, instantiate to brand
 *
 * CustomerIdSchema and OrderIdSchema are both UUID strings at runtime, but
 * their branded TypeScript types are mutually incompatible. The canonical
 * Bastian Balthazar Bux fixtures provide the concrete UUID values.
 */

import { Transform } from '../../../src/index.js';
import type { BrandOutputType } from '../../../src/types/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BrandedCustIdSchema = Transform.brand(
  {
    '$id': 'https://bookstore.example/BrandedCustId',
    'format': 'uuid',
    'type': 'string'
  } as const,
  'CustomerId'
);

const BrandedOrdIdSchema = Transform.brand(
  {
    '$id': 'https://bookstore.example/BrandedOrdId',
    'format': 'uuid',
    'type': 'string'
  } as const,
  'OrderId'
);

type CustomerId = BrandOutputType<typeof BrandedCustIdSchema>;

jt.set(BrandedCustIdSchema);
jt.set(BrandedOrdIdSchema);

// The only way to obtain a branded value — go through instantiate.
const cid = jt.instantiate(BrandedCustIdSchema, aboxFixtures.customer.customerId);

// At compile time: CustomerId ≠ OrderId — the types are nominally distinct.
function lookupCustomer(_: CustomerId): void {
  // no-op in this demonstration
}
// OK — typed correctly
lookupCustomer(cid as CustomerId);

console.assert(typeof cid === 'string');
console.assert(cid === aboxFixtures.customer.customerId);
console.log('CustomerId (branded):', cid);
// Both are plain strings at runtime; the brand is compile-time only.
console.log('runtime typeof cid  :', typeof cid);
