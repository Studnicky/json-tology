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
    'customerId': '09f8e7d6-c5b4-4321-9876-543210fedcba',
    'orderId': 'a4d3c2b1-a098-4654-a210-fedcba987654',
    'orderLines': [],
    'orderTotal': {
      'amount': 999,
      'currency': 'EUR'
    },
    'placedAt': '1979-09-01T00:00:00Z',
    'shippingAddress': {
      'city': 'München',
      'country': 'DE',
      'postalCode': '80331',
      'street': 'Reichenbachstraße 14'
    },
    ...overrides
  };
}

const ordinary = orderFixture();
const discounted = orderFixture({
  'orderTotal': {
    'amount': 450,
    'currency': 'EUR'
  }
});

console.assert(typeof ordinary.orderId === 'string');
console.assert(typeof discounted.orderId === 'string');

console.log('LooseInputType<Order>: fixture uses plain primitives — no branded values required');
console.log('ordinary orderId:', ordinary.orderId);
console.log('ordinary orderTotal:', JSON.stringify(ordinary.orderTotal));
console.log('discounted orderTotal:', JSON.stringify(discounted.orderTotal));
