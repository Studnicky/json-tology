/**
 * Compose.intersection — Example 1: AuditedOrder = Order ∩ Audit
 * Demonstrates: allOf composition, all constituent schemas must pass
 *
 * AuditSchema and AuditedOrderSchema register onto the canonical bookstore
 * via `jt.set()` — no mini-registry. The order payload is
 * the canonical Bastian-orders-Neverending-Story fixture.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const AuditSchema = {
  '$id': 'https://bookstore.example/Audit',
  'properties': {
    'createdAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'updatedAt': {
      'format': 'date-time',
      'type': 'string'
    }
  },
  'required': [
    'createdAt',
    'updatedAt'
  ],
  'type': 'object'
} as const;

const AuditedOrderSchema = Compose.intersection(
  [
    OrderSchema,
    AuditSchema
  ] as const,
  'https://bookstore.example/AuditedOrder'
);

jt.set(AuditSchema);
jt.set(AuditedOrderSchema);

// Bastian's order without audit metadata — AuditSchema required fields not met.
const errors = jt.validate(AuditedOrderSchema.$id, aboxFixtures.order);

console.assert(errors.length > 0);

// All fields present — passes.
const valid = jt.validate(AuditedOrderSchema.$id, {
  ...aboxFixtures.order,
  'createdAt': aboxFixtures.order.placedAt,
  'updatedAt': aboxFixtures.order.placedAt
});

console.assert(valid.length === 0);
