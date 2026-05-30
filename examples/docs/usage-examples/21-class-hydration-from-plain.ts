/**
 * Class hydration — `Order.fromPlain(plain)` lift strategy
 *
 * Recommended for classes with `#privateFields`, non-trivial
 * constructors, derived state, or invariants the class needs to
 * enforce on construction. The class stays in control of its own
 * initialization at the cost of a few extra lines per entity.
 *
 * Registered on a `Compose.equivalent` sibling of `OrderSchema` so
 * the canonical scenario keeps its plain wire shape.
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

class OrderViaFromPlain {
  public static fromPlain(plain: OrderWire): OrderViaFromPlain {
    const built = new OrderViaFromPlain(plain.orderId, plain.customerId);

    built.orderLines = plain.orderLines;
    built.orderTotal = plain.orderTotal;
    built.shippingAddress = plain.shippingAddress;
    built.placedAt = plain.placedAt;

    return built;
  }

  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];

  public constructor(
    public readonly orderId: string,
    public readonly customerId: string
  ) {}

  public toPlain(): {
    readonly 'customerId': string;
    readonly 'orderId': string;
    readonly 'orderLines': OrderWire['orderLines'];
    readonly 'orderTotal': OrderWire['orderTotal'];
    readonly 'placedAt': OrderWire['placedAt'];
    readonly 'shippingAddress': OrderWire['shippingAddress'];
  } {
    return {
      'customerId': this.customerId,
      'orderId': this.orderId,
      'orderLines': this.orderLines,
      'orderTotal': this.orderTotal,
      'placedAt': this.placedAt,
      'shippingAddress': this.shippingAddress
    };
  }
}

const FromPlainOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/FromPlainOrder' } as const
);

jt.set(FromPlainOrderSchema);

const FromPlainOrderTransform = Transform.create<typeof FromPlainOrderSchema, OrderViaFromPlain>(FromPlainOrderSchema, {
  'decode': (plain) => {
    return OrderViaFromPlain.fromPlain(plain as OrderWire);
  },
  'encode': (instance) => {
    return instance.toPlain();
  }
});

const hydrated = jt.instantiate(FromPlainOrderTransform, aboxFixtures.order);

console.assert(hydrated instanceof OrderViaFromPlain);
console.assert(hydrated.orderId === aboxFixtures.order.orderId);
console.assert(hydrated.customerId === aboxFixtures.order.customerId);
