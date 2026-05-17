/**
 * Compose.intersection — Example 1: AuditedOrder = Order ∩ Audit
 * Demonstrates: allOf composition, all constituent schemas must pass
 *
 * AuditSchema and AuditedOrderSchema register onto the canonical bookstore
 * via `bookstoreEntities.set()` — no mini-registry. The order payload is
 * the canonical Bastian-orders-Neverending-Story fixture.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

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

bookstoreEntities.set(AuditSchema);
bookstoreEntities.set(AuditedOrderSchema);

// Bastian's order without audit metadata — AuditSchema required fields not met.
const errors = bookstoreEntities.validate(AuditedOrderSchema.$id, aboxFixtures.order);

console.assert(errors.length > 0);

// All fields present — passes.
const valid = bookstoreEntities.validate(AuditedOrderSchema.$id, {
  ...aboxFixtures.order,
  'createdAt': aboxFixtures.order.placedAt,
  'updatedAt': aboxFixtures.order.placedAt
});

console.assert(valid.length === 0);
