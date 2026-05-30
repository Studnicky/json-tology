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

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// Browser-safe strict assertions (same shape as node:assert's strict mode),
// so this round-trip test runs anywhere, not just under Node.
const assert = {
  deepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message ?? 'values are not deep-equal');
    }
  },
  ok(value: boolean, message?: string): void {
    if (!value) {
      throw new Error(message ?? 'expected a truthy value');
    }
  }
};

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

type OrderWire = typeof aboxFixtures.order;

class RoundTripOrder {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
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

console.log('hydrated instance is RoundTripOrder:', instance instanceof RoundTripOrder);
console.log('round-trip encode(decode(wire)) deep-equals wire:', JSON.stringify(reEncoded) === JSON.stringify(wire));
