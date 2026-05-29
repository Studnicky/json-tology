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
  declare public id: string;
  declare public items: OrderWire['items'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
  declare public total: OrderWire['total'];

  public toJSON(): {
    readonly 'customerId': string;
    readonly 'id': string;
    readonly 'items': OrderWire['items'];
    readonly 'placedAt': OrderWire['placedAt'];
    readonly 'shippingAddress': OrderWire['shippingAddress'];
    readonly 'total': OrderWire['total'];
  } {
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

console.assert(wire.id === aboxFixtures.order.id);
// JSON.stringify will use the same toJSON shape.
const cloned: unknown = structuredClone(hydrated.toJSON());

console.assert(typeof cloned === 'object');
