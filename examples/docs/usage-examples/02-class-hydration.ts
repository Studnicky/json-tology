/**
 * Class hydration — Example 1: wire-form Order → Order class instance
 *
 * `Transform.create`'s decode/encode pair is a generic wire-to-runtime
 * bridge — "runtime" is allowed to be a class with methods, getters,
 * and `instanceof` identity. The decoder turns the canonical
 * Bastian-orders-Neverending-Story fixture into an `OrderRecord`
 * class instance; the encoder round-trips back to the wire shape.
 *
 * The transform is registered on a `Compose.equivalent` of `OrderSchema`
 * (a structurally-identical sibling) rather than the canonical
 * `OrderSchema` directly, so the canonical schema's existing
 * `orderTotalMatchesItems` invariant and other examples keep their
 * plain wire-shape behaviour.
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

class OrderRecord {
  public constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly items: OrderWire['items'],
    public readonly total: OrderWire['total'],
    public readonly shippingAddress: OrderWire['shippingAddress'],
    public readonly placedAt: string
  ) {}

  public totalWithTax(rate = 0.19): number {
    return this.total.amount * (1 + rate);
  }
}

const OrderRecordSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/OrderRecord' } as const
);

jt.set(OrderRecordSchema);

Transform.create<typeof OrderRecordSchema, OrderRecord>(OrderRecordSchema, {
  'decode': (input) => {
    const wire = input as OrderWire;

    return new OrderRecord(
      wire.id,
      wire.customerId,
      wire.items,
      wire.total,
      wire.shippingAddress,
      wire.placedAt
    );
  },
  'encode': (record) => {
    return {
      'customerId': record.customerId,
      'id': record.id,
      'items': record.items,
      'placedAt': record.placedAt,
      'shippingAddress': record.shippingAddress,
      'total': record.total
    };
  }
});

const hydrated = jt.instantiate(
  OrderRecordSchema,
  aboxFixtures.order
);

console.assert(hydrated instanceof OrderRecord);
console.assert((hydrated as OrderRecord).totalWithTax() > aboxFixtures.order.total.amount);

// Encoder round-trips back to wire shape.
const wire = bookstoreEntities.encode(OrderRecordSchema, hydrated as OrderRecord) as Record<string, unknown>;

console.assert(typeof wire.id === 'string');
console.assert(Array.isArray(wire.items));
