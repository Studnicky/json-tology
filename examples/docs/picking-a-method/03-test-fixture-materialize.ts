/**
 * Picking a method: test fixture — materialize for trusted construction
 *
 * `materialize` is for data you produce: test fixtures, form scaffolding,
 * default-filled instances. Failure is your own bug — the schema contract
 * has not been met. The method validates by default and throws
 * `MaterializationError` if validation fails.
 *
 * Pass `{ enablePartial: true }` to allow missing required-without-default
 * fields during lenient construction (form scaffolding use case).
 */

import type { Order } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Full fixture — all required fields present. materialize succeeds.
// materialize takes a schema object (not a $id string) as its first argument;
// the result is typed via the registry's Order (the partial input carries
// plain literals, so the materialize generic falls back to an untyped result).
const order = bookstoreEntities.materialize(OrderSchema, { ...aboxFixtures.order }) as Order;

console.assert(order.customerId === aboxFixtures.order.customerId);
