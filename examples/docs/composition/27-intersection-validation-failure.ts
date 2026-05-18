/**
 * Compose.intersection — Example 2: Validation fails if any constituent fails
 *
 * `AuditedOrderSchema` combines OrderSchema with an AuditSchema. The
 * Bastian order fixture (no audit metadata) fails because the Audit
 * required fields are missing.
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
  '$id': 'https://bookstore.example/AuditFails',
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
  'https://bookstore.example/AuditedOrderFails'
);

jt.set(AuditSchema);
jt.set(AuditedOrderSchema);

// Missing createdAt and updatedAt — fails AuditSchema constraints.
const errors = jt.validate(AuditedOrderSchema.$id, aboxFixtures.order);

console.assert(!errors.ok);
console.assert(errors.length > 0);
