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

class OrderViaNew {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];

  public summary(): string {
    return `order ${this.orderId}`;
  }
}

const NewOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/NewOrder' } as const
);

jt.set(NewOrderSchema);

// Class is the wire side: decode lowers to JSON, encode hydrates from JSON.
const NewOrderTransform = jt.addTransform(NewOrderSchema, {
  'decode': (instance: OrderViaNew) => {
    return {
      'customerId': instance.customerId,
      'orderId': instance.orderId,
      'orderLines': instance.orderLines,
      'orderTotal': instance.orderTotal,
      'placedAt': instance.placedAt,
      'shippingAddress': instance.shippingAddress
    };
  },
  'encode': (wire) => {
    const source = wire as OrderWire;

    return Object.assign(new OrderViaNew(), {
      'customerId': source.customerId,
      'orderId': source.orderId,
      'orderLines': source.orderLines,
      'orderTotal': source.orderTotal,
      'placedAt': source.placedAt,
      'shippingAddress': source.shippingAddress
    });
  }
});

// Hydrate canonical JSON via encode.
const hydrated = jt.encode(NewOrderTransform, aboxFixtures.order as unknown as OrderWire);

console.assert(hydrated instanceof OrderViaNew);
console.assert(hydrated.summary().startsWith('order '));
// true
console.log('instanceof:', hydrated instanceof OrderViaNew);
// 'order <orderId>'
console.log('summary():', hydrated.summary());
