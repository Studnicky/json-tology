/**
 * Class hydration — `Reflect.construct(Class, [])` lift strategy
 *
 * Default strategy for parameterless constructors. Works whether or
 * not the constructor takes arguments because `Reflect.construct` is
 * called with an empty arg list. Tradeoff: the constructor runs once
 * per `instantiate` — if it does I/O or registers itself with a
 * parent collection, that work repeats on every decode.
 *
 * Registered on a `Compose.equivalent` sibling of `OrderSchema` so
 * the canonical Bastian-orders-Neverending-Story scenario keeps its
 * plain wire-shape behaviour everywhere else.
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

class OrderViaReflect {
  declare public customerId: string;
  declare public id: string;
  declare public items: OrderWire['items'];
  declare public total: OrderWire['total'];

  public status(): string {
    return `shipped:${this.id}`;
  }
}

const ReflectOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/ReflectOrder' } as const
);

jt.set(ReflectOrderSchema);

Transform.create<typeof ReflectOrderSchema, OrderViaReflect>(ReflectOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(OrderViaReflect, []), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const hydrated = jt.instantiate(ReflectOrderSchema, aboxFixtures.order);

console.assert(hydrated instanceof OrderViaReflect);
console.assert((hydrated as OrderViaReflect).status().startsWith('shipped:'));
