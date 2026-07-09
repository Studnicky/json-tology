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

import { Compose } from '../../../src/index.js';
import type { UnbrandType } from '../../../src/types/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// The canonical (brand-free, structurally-widened) Order shape — what the
// transform's decode produces and encode consumes.
type OrderWire = UnbrandType<typeof aboxFixtures.order>;

class OrderRecord {
  public constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly orderLines: OrderWire['orderLines'],
    public readonly orderTotal: OrderWire['orderTotal'],
    public readonly shippingAddress: OrderWire['shippingAddress'],
    public readonly placedAt: string
  ) {}

  public totalWithTax(rate = 0.19): number {
    return this.orderTotal.amount * (1 + rate);
  }
}

const OrderRecordSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/OrderRecord' } as const
);

jt.set(OrderRecordSchema);

// Class hydration uses a normalize transform in REVERSE: the class is the wire
// side (TWire), the schema's canonical JSON is what `instantiate` validates.
//   - decode (wire → canonical): lowers an OrderRecord instance to canonical JSON.
//   - encode (canonical → wire): hydrates canonical JSON into an OrderRecord.
// So hydration is `encode`; validating a record into canonical JSON is `instantiate`.
// `addTransform` (instance-bound) resolves the canonical via the registry's refs.
const OrderRecordTransform = jt.addTransform(OrderRecordSchema, {
  'decode': (record: OrderRecord) => {
    return {
      'customerId': record.customerId,
      'orderId': record.orderId,
      'orderLines': record.orderLines,
      'orderTotal': record.orderTotal,
      'placedAt': record.placedAt,
      'shippingAddress': record.shippingAddress
    };
  },
  'encode': (wire) => {
    // The canonical Order is structurally wider than the fixture-shaped record
    // (variadic orderLines, optional address fields). Narrow once at the
    // hydration boundary — the runtime values are the validated canonical JSON.
    const source = wire as OrderWire;

    return new OrderRecord(
      source.orderId,
      source.customerId,
      source.orderLines,
      source.orderTotal,
      source.shippingAddress,
      source.placedAt
    );
  }
});

// Hydrate canonical JSON into a class instance — the encode direction.
const hydrated = jt.encode(OrderRecordTransform, aboxFixtures.order as unknown as OrderWire);

console.assert(hydrated instanceof OrderRecord);
console.assert(hydrated.totalWithTax() > aboxFixtures.order.orderTotal.amount);
// true
console.log('instanceof OrderRecord:', hydrated instanceof OrderRecord);
// amount * 1.19
console.log('totalWithTax (19%):', hydrated.totalWithTax());

// Lower a class instance back to validated canonical JSON — the decode direction,
// run by instantiate.
const wire = jt.instantiate(OrderRecordTransform, hydrated);

console.assert(typeof wire.orderId === 'string');
console.assert(Array.isArray(wire.orderLines));
// same UUID as fixture
console.log('re-encoded orderId:', wire.orderId);
