/**
 * Class hydration — round-trip property test pattern
 *
 * Class hydration is correct only if `decode(encode(wire))` deep-equals
 * `wire`. Validate that with an assert. The pair of `decode` and
 * `encode` are independent functions; nothing forces them to be
 * inverses, so a round-trip test catches drift the moment it
 * happens — before it propagates into queue payloads, database
 * rows, or HTTP responses.
 */

import type { UnbrandType } from '../../../src/types/index.js';
import {
  Compose
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
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

// The canonical (brand-free) Order shape
type OrderWire = UnbrandType<typeof aboxFixtures.order>;

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

// Class is the wire side: encode hydrates, decode lowers.
const RoundTripOrderTransform = jt.addTransform(RoundTripOrderSchema, {
  'decode': (instance: RoundTripOrder) => {
    return { ...instance };
  },
  'encode': (wire) => {
    const source = wire as OrderWire;

    return Object.assign(Reflect.construct(RoundTripOrder, []), source);
  }
});

const wire = aboxFixtures.order;
// Hydrate canonical JSON via encode.
const instance = jt.encode(RoundTripOrderTransform, wire);

assert.ok(instance instanceof RoundTripOrder);

// Lower the instance back to canonical JSON via instantiate (which calls decode).
const reLowered = jt.instantiate(RoundTripOrderTransform, instance);

assert.deepStrictEqual(reLowered, wire);

console.log('hydrated instance is RoundTripOrder:', instance instanceof RoundTripOrder);
console.log('round-trip instantiate(encode(wire)) deep-equals wire:', JSON.stringify(reLowered) === JSON.stringify(wire));
