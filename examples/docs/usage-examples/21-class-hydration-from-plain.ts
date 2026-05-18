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
    const built = new OrderViaFromPlain(plain.id, plain.customerId);

    built.items = plain.items;
    built.total = plain.total;
    built.shippingAddress = plain.shippingAddress;
    built.placedAt = plain.placedAt;

    return built;
  }

  declare public items: OrderWire['items'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
  declare public total: OrderWire['total'];

  public constructor(
    public readonly id: string,
    public readonly customerId: string
  ) {}

  public toPlain(): OrderWire {
    return {
      'customerId': this.customerId,
      'id': this.id,
      'items': this.items,
      'placedAt': this.placedAt,
      'shippingAddress': this.shippingAddress,
      'total': this.total
    };
  }
}

const FromPlainOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/FromPlainOrder' } as const
);

jt.set(FromPlainOrderSchema);

Transform.create<typeof FromPlainOrderSchema, OrderViaFromPlain>(FromPlainOrderSchema, {
  'decode': (plain) => {
    return OrderViaFromPlain.fromPlain(plain as OrderWire);
  },
  'encode': (instance) => {
    return instance.toPlain();
  }
});

const hydrated = jt.instantiate(FromPlainOrderSchema, aboxFixtures.order);

console.assert(hydrated instanceof OrderViaFromPlain);
console.assert((hydrated as OrderViaFromPlain).customerId === aboxFixtures.order.customerId);
