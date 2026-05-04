/**
 * addInvariant / removeInvariant — Example 1: Order total must match items
 * Demonstrates: invariant failure in errors(), coerce(), is()
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/index.js';
import {
  CurrencyCodeSchema, CustomerIdSchema, IsbnSchema, Iso8601Schema,
  MoneySchema, OrderIdSchema, OrderLineSchema,
  OrderSchema, QuantitySchema
} from '../bookstore/index.js';

type Order = InferType<typeof OrderSchema>;

const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'invariants': {
    [OrderSchema.$id]: [{
      'fn': (order) => {
        const typed = order as Order;
        const computed = (typed.items as Array<{
          'quantity': number;
          'unitPrice': number;
        }>).reduce((sum, line) => {
          return sum + line.unitPrice * line.quantity;
        }, 0);

        return Math.abs(typed.total - computed) < 0.01
          ? null
          : `total must equal sum of items (expected ${computed.toFixed(2)}, got ${String(typed.total)})`;
      },
      'name': 'totalMatchesItems',
      'pointer': '/total'
    }]
  },
  'schemas': [
    CurrencyCodeSchema,
    CustomerIdSchema,
    Iso8601Schema,
    IsbnSchema,
    MoneySchema,
    OrderIdSchema,
    QuantitySchema,
    OrderLineSchema,
    OrderSchema
  ] as const
});

const invalidOrder = {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 1,
    'unitPrice': 14.99
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'total': 99
};

// errors() surfaces invariant failure
const errs = localJt.errors(OrderSchema.$id, invalidOrder);

console.assert(!errs.ok);
console.assert(errs.items.some((errItem) => {
  return errItem.keyword === 'jt:invariant';
}));

// is() returns false
console.assert(!localJt.is(OrderSchema.$id, invalidOrder));

// removeInvariant works
localJt.removeInvariant(OrderSchema.$id, 'totalMatchesItems');

// After removal, invariant no longer fires
const errs2 = localJt.errors(OrderSchema.$id, invalidOrder);

console.assert(errs2.items.every((errItem) => {
  return errItem.keyword !== 'jt:invariant';
}));
