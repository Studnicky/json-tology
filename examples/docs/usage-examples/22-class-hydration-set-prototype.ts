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

import type { UnbrandType } from '../../../src/types/index.js';
import {
  Compose
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// The canonical (brand-free) Order shape
type OrderWire = UnbrandType<typeof aboxFixtures.order>;

class OrderViaProto {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];

  public lineCount(): number {
    return this.orderLines.length;
  }
}

const ProtoOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/ProtoOrder' } as const
);

jt.set(ProtoOrderSchema);

// Class is the wire side: encode swaps prototype in place, decode spreads to plain object.
const ProtoOrderTransform = jt.addTransform(ProtoOrderSchema, {
  'decode': (instance: OrderViaProto) => {
    const {
      customerId, orderId, orderLines, orderTotal, placedAt, shippingAddress
    } = instance;

    return {
      customerId,
      orderId,
      orderLines,
      orderTotal,
      placedAt,
      shippingAddress
    };
  },
  'encode': (wire) => {
    const source = wire as OrderWire;
    const copy = {
      'customerId': source.customerId,
      'orderId': source.orderId,
      'orderLines': source.orderLines,
      'orderTotal': source.orderTotal,
      'placedAt': source.placedAt,
      'shippingAddress': source.shippingAddress
    };

    Object.setPrototypeOf(copy, OrderViaProto.prototype);

    return copy as OrderViaProto;
  }
});

// Hydrate canonical JSON via encode.
const hydrated = jt.encode(ProtoOrderTransform, { ...aboxFixtures.order } as unknown as OrderWire);

console.assert(hydrated instanceof OrderViaProto);
console.assert(hydrated.lineCount() === aboxFixtures.order.orderLines.length);
// true — prototype swapped in place
console.log('instanceof:', hydrated instanceof OrderViaProto);
// same as orderLines.length
console.log('lineCount():', hydrated.lineCount());
