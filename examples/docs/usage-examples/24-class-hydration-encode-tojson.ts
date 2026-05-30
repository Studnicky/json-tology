/**
 * Class hydration — encode direction: `instance.toJSON()`
 *
 * The class already defines `toJSON` for `JSON.stringify` integration;
 * the encode body reuses it so there is one source of truth for
 * serialization shape.
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

class OrderWithToJson {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];

  public toJSON(): {
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

const ToJsonOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/ToJsonOrder' } as const
);

jt.set(ToJsonOrderSchema);

const ToJsonOrderTransform = Transform.create<typeof ToJsonOrderSchema, OrderWithToJson>(ToJsonOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(OrderWithToJson, []), plain);
  },
  'encode': (instance) => {
    return instance.toJSON();
  }
});

const hydrated = jt.instantiate(
  ToJsonOrderTransform,
  aboxFixtures.order
);

const wire = bookstoreEntities.encode(ToJsonOrderTransform, hydrated) as Record<string, unknown>;

console.assert(wire.orderId === aboxFixtures.order.orderId);
// JSON.stringify will use the same toJSON shape.
const cloned: unknown = structuredClone(hydrated.toJSON());

console.assert(typeof cloned === 'object');
// same as fixture — toJSON() is the encode source
console.log('wire orderId:', wire.orderId);
// 'object' — structuredClone works on toJSON output
console.log('cloned type:', typeof cloned);
