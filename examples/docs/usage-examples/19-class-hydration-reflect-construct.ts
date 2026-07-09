/**
 * Class hydration — `Reflect.construct(Class, [])` lift strategy
 *
 * Default strategy for parameterless constructors. Works whether or
 * not the constructor takes arguments because `Reflect.construct` is
 * called with an empty arg list. Tradeoff: the constructor runs once
 * per `encode` — if it does I/O or registers itself with a
 * parent collection, that work repeats on every hydration.
 *
 * Registered on a `Compose.equivalent` sibling of `OrderSchema` so
 * the canonical Bastian-orders-Neverending-Story scenario keeps its
 * plain wire-shape behaviour everywhere else.
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

// The canonical (brand-free) Order shape — what the transform's encode consumes
type OrderWire = UnbrandType<typeof aboxFixtures.order>;

class OrderViaReflect {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];

  public status(): string {
    return `shipped:${this.orderId}`;
  }
}

const ReflectOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/ReflectOrder' } as const
);

jt.set(ReflectOrderSchema);

// Class hydration: the class is the wire side (TWire).
// - decode (class → canonical): lowers an OrderViaReflect instance to JSON.
// - encode (canonical → class): hydrates canonical JSON into an OrderViaReflect.
const ReflectOrderTransform = jt.addTransform(ReflectOrderSchema, {
  'decode': (instance: OrderViaReflect) => {
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
    const hydrated = Reflect.construct(OrderViaReflect, []);

    return Object.assign(hydrated, {
      'customerId': source.customerId,
      'orderId': source.orderId,
      'orderLines': source.orderLines,
      'orderTotal': source.orderTotal,
      'placedAt': source.placedAt,
      'shippingAddress': source.shippingAddress
    });
  }
});

// Hydrate canonical JSON into a class instance via encode.
const hydrated = jt.encode(ReflectOrderTransform, aboxFixtures.order as unknown as OrderWire);

console.assert(hydrated instanceof OrderViaReflect);
console.assert(hydrated.status().startsWith('shipped:'));
// true
console.log('instanceof:', hydrated instanceof OrderViaReflect);
// 'shipped:<orderId>'
console.log('status():', hydrated.status());
