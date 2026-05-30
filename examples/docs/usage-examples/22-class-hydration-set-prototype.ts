/**
 * Class hydration — `Object.setPrototypeOf(plain, Order.prototype)`
 *
 * Hot-path lift strategy: skips the constructor entirely and reuses
 * the validated wire object as the instance backing store. Allocation
 * cost: zero. Tradeoff: private (`#`) fields are not initialized, so
 * any access throws `TypeError: Cannot read private member from an
 * object whose class did not declare it`. Use only when the class
 * has no `#` fields and the constructor has no required work.
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

class OrderViaProto {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];

  public lineCount(): number {
    return this.orderLines.length;
  }
}

const ProtoOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/ProtoOrder' } as const
);

jt.set(ProtoOrderSchema);

Transform.create<typeof ProtoOrderSchema, OrderViaProto>(ProtoOrderSchema, {
  'decode': (plain) => {
    Object.setPrototypeOf(plain, OrderViaProto.prototype);

    return plain as OrderViaProto;
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const hydrated = jt.instantiate(ProtoOrderSchema, { ...aboxFixtures.order });

console.assert(hydrated instanceof OrderViaProto);
console.assert((hydrated as OrderViaProto).lineCount() === aboxFixtures.order.orderLines.length);
