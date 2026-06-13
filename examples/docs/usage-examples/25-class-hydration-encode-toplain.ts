/**
 * Class hydration — decode direction: explicit `instance.toPlain()`
 *
 * The class needs to omit derived fields, hide private state, or
 * apply transforms before lowering to canonical JSON. `toPlain()` is a useful
 * convention when `toJSON` is reserved for a different output
 * format (e.g. an external API representation).
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

// Class is the wire side: decode uses toPlain, encode hydrates from JSON.
const ToPlainOrderTransform = jt.addTransform(ToPlainOrderSchema, {
  'decode': (instance: OrderWithToPlain) => {
    return instance.toPlain();
  },
  'encode': (wire) => {
    const source = wire as OrderWire;
    // real `new` keeps the # field initialized.
    const built = new OrderWithToPlain();

    return Object.assign(built, source);
  }
});

// Hydrate canonical JSON via encode.
const hydrated = jt.encode(
  ToPlainOrderTransform,
  aboxFixtures.order
);

hydrated.cacheTouch();
console.assert(hydrated.cacheTouched());

// The instance has toPlain; decode will call it when lowering back to JSON.
// Demonstrate by calling toPlain directly on the hydrated instance:
const viaToPlain = hydrated.toPlain();

console.assert(viaToPlain.orderId === aboxFixtures.order.orderId);
// internalCacheKey is deliberately omitted from the wire shape.
console.assert(!('internalCacheKey' in viaToPlain));
// true — # field lives in the instance
console.log('cacheTouched:', hydrated.cacheTouched());
// present — toPlain() includes it
console.log('viaToPlain orderId:', viaToPlain.orderId);
// false — omitted by toPlain()
console.log('viaToPlain has private key?', 'internalCacheKey' in viaToPlain);
