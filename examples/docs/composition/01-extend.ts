/**
 * Compose.extend — Example 1: CustomerWithDiscount adds discount fields
 * Demonstrates: layering fields onto the canonical Customer via Compose.extend
 *
 * The derived schema is registered onto the canonical bookstore via
 * `jt.set()`. No mini-registry: every example operates
 * against the one source of truth.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const CustomerWithDiscountSchema = Compose.extend(
  CustomerSchema,
  {
    'discountRate': {
      'default': 0,
      'maximum': 1,
      'minimum': 0,
      'type': 'number'
    },
    'tier': {
      'enum': [
        'bronze',
        'silver',
        'gold'
      ],
      'type': 'string'
    }
  } as const,
  'https://bookstore.example/CustomerWithDiscount'
);

const jt2 = jt.set(CustomerWithDiscountSchema);

const coercedCustomer = jt2.instantiate(CustomerWithDiscountSchema.$id, {
  'discountRate': 0.15,
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux',
  'tier': 'silver'
}) as Record<string, unknown>;

console.assert(coercedCustomer.discountRate === 0.15);
console.assert(coercedCustomer.tier === 'silver');
console.assert(coercedCustomer.name === 'Bastian Balthazar Bux');
