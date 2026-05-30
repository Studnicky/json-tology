/**
 * Class hydration — `Object.assign(new Order(), plain)` lift strategy
 *
 * Same case as `Reflect.construct` but with the familiar `new` syntax.
 * Only valid when the constructor is parameterless or all parameters
 * are optional. Same constructor side-effect concern as 19; fails at
 * compile time if the constructor signature requires arguments.
 *
 * Registered on a `Compose.equivalent` sibling of `OrderSchema`.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

type OrderWire = typeof aboxFixtures.order;

class OrderViaNew {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];

  public summary(): string {
    return `order ${this.orderId}`;
  }
}

const NewOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/NewOrder' } as const
);

jt.set(NewOrderSchema);

Transform.create<typeof NewOrderSchema, OrderViaNew>(NewOrderSchema, {
  'decode': (plain) => {
    return Object.assign(new OrderViaNew(), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const hydrated = jt.instantiate(NewOrderSchema, aboxFixtures.order);

console.assert(hydrated instanceof OrderViaNew);
console.assert((hydrated as OrderViaNew).summary().startsWith('order '));
