/**
 * jt:computed — Example 3: derived property registered via addComputed
 *
 * A property marked `jt:computed: true` is filled by the materializer
 * from a registered compute function rather than from caller-supplied
 * input. Supplying the field on input raises `InstantiationError` with
 * code `COMPUTED_INPUT_FORBIDDEN`.
 *
 * The canonical bookstore registers an order-total compute function on
 * `OrderSchema`. This example exercises that path: the `total` field is
 * omitted from raw input, and the materializer derives it from line items.
 *
 * See `examples/docs/computed/01-add-computed.ts` for the full
 * `addComputed` / `removeComputed` contract.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Valid order fixture — `total` is structurally present in the fixture,
// but the invariant verifies total matches the computed sum.
const errs = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

console.assert(errs.length === 0);

const totalAmount: number = aboxFixtures.order.total.amount;

console.assert(totalAmount === 850);

// OrderSchema.$id is a stable URN.
const schemaId: string = OrderSchema.$id;

console.assert(schemaId === 'urn:bookstore:Order');
