/**
 * Class hydration — decode direction: `instance.toJSON()`
 *
 * The class already defines `toJSON` for `JSON.stringify` integration;
 * the decode body reuses it so there is one source of truth for
 * lowering shape when converting back to canonical JSON.
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

// Class is the wire side: decode uses toJSON, encode hydrates from JSON.
const ToJsonOrderTransform = jt.addTransform(ToJsonOrderSchema, {
  'decode': (instance: OrderWithToJson) => {
    return instance.toJSON();
  },
  'encode': (wire) => {
    const source = wire as OrderWire;

    return Object.assign(Reflect.construct(OrderWithToJson, []), source);
  }
});

// Hydrate canonical JSON via encode.
const hydrated = jt.encode(
  ToJsonOrderTransform,
  aboxFixtures.order
);

// The instance has toJSON; decode will call it when lowering back to JSON.
// Demonstrate by calling toJSON directly on the hydrated instance:
const viaTojson = hydrated.toJSON();

console.assert(viaTojson.orderId === aboxFixtures.order.orderId);
// JSON.stringify will use the same toJSON shape.
const cloned: unknown = structuredClone(viaTojson);

console.assert(typeof cloned === 'object');
// same as fixture — toJSON() is what decode uses
console.log('viaTojson orderId:', viaTojson.orderId);
// 'object' — structuredClone works on toJSON output
console.log('cloned type:', typeof cloned);
