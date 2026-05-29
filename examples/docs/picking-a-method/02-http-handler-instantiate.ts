/**
 * Picking a method: HTTP handler — instantiate at the trust boundary
 *
 * `instantiate` is for data crossing from outside: HTTP request bodies,
 * queue messages, file imports. Failure is the caller's contract violation.
 * The error is theirs to handle — return 400, log and re-queue, etc.
 *
 * Uses the canonical bookstore order fixture to simulate a valid HTTP payload,
 * then a tampered payload to show the error path.
 */

import {
  InstantiationError
} from '../../../src/index.js';
import type { Order } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Simulate parsing a raw request body. In a real handler this would be
// `await req.json()` — unknown shape from the wire.
const rawPayload: unknown = { ...aboxFixtures.order };

let order: null | Order = null;
let statusCode = 200;

try {
  order = bookstoreEntities.instantiate(OrderSchema.$id, rawPayload);
} catch (error) {
  if (error instanceof InstantiationError) {
    statusCode = 400;
  } else {
    throw error;
  }
}

// Valid payload — instantiate succeeds.
console.assert(statusCode === 200);
console.assert(order !== null);

if (order !== null) {
  console.assert(order.customerId === aboxFixtures.order.customerId);
}

// Tampered payload — missing required `id`.
const {
  'id': _omit, ...payloadWithoutId
} = aboxFixtures.order;

void _omit;

let caughtBad = false;

try {
  bookstoreEntities.instantiate(OrderSchema, payloadWithoutId);
} catch (error) {
  if (error instanceof InstantiationError) {
    caughtBad = true;
  }
}

console.assert(caughtBad);

// Instance form reuse — bookstoreEntities resolves all transitive $refs
// (CustomerId, OrderLine, Money, etc.), so the same registry handles every
// subsequent call without re-compiling.
const staticOrder = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

console.assert(staticOrder.id === aboxFixtures.order.id);
