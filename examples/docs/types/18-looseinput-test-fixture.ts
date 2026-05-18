/**
 * LooseInputType — Example: Test helpers that produce fixture data.
 *
 * A test factory accepts plain primitives so the caller can build
 * fixtures without producing branded values. Validation happens later,
 * if at all, when the fixture is fed to `instantiate`.
 */

import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';
import type { OrderSchema } from '../bookstore/index.js';

type Order = InferType<typeof OrderSchema>;

// Test factory accepts plain primitives — no need to produce branded values.
function orderFixture(overrides: Partial<LooseInputType<Order>> = {}): Record<string, unknown> {
  return {
    'currency': 'EUR',
    'customerId': '09f8e7d6-c5b4-4321-9876-543210fedcba',
    'id': 'a4d3c2b1-a098-4654-a210-fedcba987654',
    'items': [],
    'placedAt': '1979-09-01T00:00:00Z',
    'total': 9.99,
    ...overrides
  };
}

const ordinary = orderFixture();
const discounted = orderFixture({ 'total': 4.5 });

console.assert(ordinary.total === 9.99);
console.assert(discounted.total === 4.5);
console.assert(ordinary.currency === discounted.currency);
