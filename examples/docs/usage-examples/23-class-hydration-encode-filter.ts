/**
 * Class hydration — decode direction: filter methods automatically
 *
 * Default in the headline example: filter out non-data values via
 * `Object.entries`. Works because prototype methods are not
 * enumerable own-properties; the filter is mostly belt-and-suspenders
 * unless the class assigns methods as instance fields (`this.foo =
 * () => ...`), in which case the filter is the only thing that
 * keeps the wire shape clean when lowering back to JSON.
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

class OrderWithInstanceMethod {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
  // Instance-field method (enumerable own-property). The filter
  // in decode below is what drops this when lowering to wire.
  public summarize = (): string => {
    return `order ${this.orderId}`;
  };
}

const FilterEncodeOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/FilterEncodeOrder' } as const
);

jt.set(FilterEncodeOrderSchema);

// Class is the wire side: decode filters out methods, encode hydrates from JSON.
const FilterEncodeOrderTransform = jt.addTransform(
  FilterEncodeOrderSchema,
  {
    'decode': (instance: OrderWithInstanceMethod) => {
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

      return Object.assign(Reflect.construct(OrderWithInstanceMethod, []), source);
    }
  }
);

// Hydrate canonical JSON via encode — the instance will have the summarize method.
const hydrated = jt.encode(
  FilterEncodeOrderTransform,
  aboxFixtures.order as unknown as OrderWire
);

console.assert(typeof hydrated.summarize === 'function');

// The decode direction filters out instance-field methods when lowering to canonical JSON.
// Demonstrate by creating an instance with the method and manually calling decode logic:
const instanceWithMethod: OrderWithInstanceMethod = Object.assign(
  Reflect.construct(OrderWithInstanceMethod, []),
  aboxFixtures.order
);

// Manually apply the filter (simulating what decode does):
const dataEntries = Object.entries(instanceWithMethod).filter(([
  , value
]) => {
  return typeof value !== 'function';
});
const filtered = Object.fromEntries(dataEntries);

console.assert(filtered.summarize === undefined);
console.assert(filtered.orderId === aboxFixtures.order.orderId);
// 'function'
console.log('instance has summarize fn:', typeof hydrated.summarize);
// false — filtered out by decoder
console.log('filtered has summarize?', 'summarize' in filtered);
// clean wire value
console.log('filtered orderId:', filtered.orderId);
