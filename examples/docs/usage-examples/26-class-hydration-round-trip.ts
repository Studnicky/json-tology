/**
 * Class hydration — round-trip property test pattern
 *
 * Class hydration is correct only if `encode(decode(x))` deep-equals
 * `x`. Validate that with an assert. The pair of `decode` and
 * `encode` are independent functions; nothing forces them to be
 * inverses, so a round-trip test catches drift the moment it
 * happens — before it propagates into queue payloads, database
 * rows, or HTTP responses.
 */

import { strict as assert } from 'node:assert';
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

class RoundTripOrder {
  declare public customerId: string;
  declare public id: string;
  declare public items: OrderWire['items'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
  declare public total: OrderWire['total'];
}

const RoundTripOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/RoundTripOrder' } as const
);

jt.set(RoundTripOrderSchema);

const RoundTripOrderTransform = Transform.create<typeof RoundTripOrderSchema, RoundTripOrder>(RoundTripOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(RoundTripOrder, []), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const wire = aboxFixtures.order;
const instance = jt.instantiate(RoundTripOrderTransform, wire);

assert.ok(instance instanceof RoundTripOrder);

const reEncoded = bookstoreEntities.encode(RoundTripOrderTransform, instance);

assert.deepStrictEqual(reEncoded, wire);
