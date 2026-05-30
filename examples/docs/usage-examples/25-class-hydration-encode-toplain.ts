/**
 * Class hydration — encode direction: explicit `instance.toPlain()`
 *
 * The class needs to omit derived fields, hide private state, or
 * apply transforms before serialization. `toPlain()` is a useful
 * convention when `toJSON` is reserved for a different output
 * format (e.g. an external API representation).
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

type OrderWire = typeof aboxFixtures.order;

class OrderWithToPlain {
  // Private state intentionally omitted from the wire shape.
  #internalCacheKey = '';

  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];

  public cacheTouch(): void {
    this.#internalCacheKey = String(Date.now());
  }

  public cacheTouched(): boolean {
    return this.#internalCacheKey.length > 0;
  }

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

const ToPlainOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/ToPlainOrder' } as const
);

jt.set(ToPlainOrderSchema);

const ToPlainOrderTransform = Transform.create<typeof ToPlainOrderSchema, OrderWithToPlain>(ToPlainOrderSchema, {
  'decode': (plain) => {
    // fromPlain pattern: real `new` keeps the # field initialized.
    const built = new OrderWithToPlain();

    return Object.assign(built, plain);
  },
  'encode': (instance) => {
    return instance.toPlain();
  }
});

const hydrated = jt.instantiate(
  ToPlainOrderTransform,
  aboxFixtures.order
);

hydrated.cacheTouch();
console.assert(hydrated.cacheTouched());

const wire = bookstoreEntities.encode(ToPlainOrderTransform, hydrated) as Record<string, unknown>;

console.assert(wire.orderId === aboxFixtures.order.orderId);
// internalCacheKey is deliberately omitted from the wire shape.
console.assert(!('internalCacheKey' in wire));
// true — # field lives in the instance
console.log('cacheTouched:', hydrated.cacheTouched());
// present — toPlain() includes it
console.log('wire orderId:', wire.orderId);
// false — omitted by toPlain()
console.log('wire has private key?', 'internalCacheKey' in wire);
