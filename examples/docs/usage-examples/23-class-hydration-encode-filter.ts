/**
 * Class hydration — encode direction: filter methods automatically
 *
 * Default in the headline example: filter out non-data values via
 * `Object.entries`. Works because prototype methods are not
 * enumerable own-properties; the filter is mostly belt-and-suspenders
 * unless the class assigns methods as instance fields (`this.foo =
 * () => ...`), in which case the filter is the only thing that
 * keeps the wire shape clean.
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

class OrderWithInstanceMethod {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
  // Instance-field method (enumerable own-property). The filter
  // below is what drops this on the way back to wire.
  public summarize = (): string => {
    return `order ${this.orderId}`;
  };
}

const FilterEncodeOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/FilterEncodeOrder' } as const
);

jt.set(FilterEncodeOrderSchema);

const FilterEncodeOrderTransform = Transform.create<
  typeof FilterEncodeOrderSchema,
  OrderWithInstanceMethod
>(FilterEncodeOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(OrderWithInstanceMethod, []), plain);
  },
  'encode': (instance) => {
    const dataEntries = Object.entries(instance).filter(([
      , value
    ]) => {
      return typeof value !== 'function';
    });

    return Object.fromEntries(dataEntries);
  }
});

const hydrated = jt.instantiate(
  FilterEncodeOrderTransform,
  aboxFixtures.order
);

console.assert(typeof hydrated.summarize === 'function');

const wire = bookstoreEntities.encode(FilterEncodeOrderTransform, hydrated) as Record<string, unknown>;

console.assert(wire.summarize === undefined);
console.assert(wire.orderId === aboxFixtures.order.orderId);
// 'function'
console.log('instance has summarize fn:', typeof hydrated.summarize);
// false — filtered out by encoder
console.log('wire has summarize?', 'summarize' in wire);
// clean wire value
console.log('wire orderId:', wire.orderId);
