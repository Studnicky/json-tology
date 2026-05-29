/**
 * Picking a method: is — boolean type guard
 *
 * `is` is a TypeScript type guard. Use it when you need to narrow a union
 * type or check unknown input without triggering a throw. The method
 * returns `true` if the data satisfies the schema, `false` otherwise.
 *
 * `is` does not apply defaults or coerce values — it is a pure predicate.
 */

import type { Order } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const incoming: unknown = { ...aboxFixtures.order };

// Passing the schema $id selects the type-guard overload, which narrows
// `incoming` to the registry's Order type within the block.
if (bookstoreEntities.is(OrderSchema.$id, incoming)) {
  // Within this block, `incoming` is narrowed to `Order`.
  const order: Order = incoming;

  console.assert(order.id === aboxFixtures.order.id);
}

// Invalid shape — is returns false.
const notAnOrder: unknown = { 'customerId': 'foo' };

console.assert(!bookstoreEntities.is(OrderSchema.$id, notAnOrder));
