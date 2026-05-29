/**
 * Compose.omit — Example 2: Order summary without line items
 *
 * Drops the `items` array from the canonical OrderSchema to produce a
 * compact summary suitable for dashboard rows. The derived type still
 * carries `id`, `customerId`, `total`, `placedAt`, and the shipping
 * address.
 */

import { Compose } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const OrderSummarySchema = Compose.omit(
  OrderSchema,
  ['items'] as const,
  'https://bookstore.example/OrderSummary'
);

type OrderSummary = InferType<typeof OrderSummarySchema>;

const jt2 = jt.set(OrderSummarySchema);

const summary: OrderSummary = {
  'customerId': aboxFixtures.order.customerId,
  'id': aboxFixtures.order.id,
  'placedAt': aboxFixtures.order.placedAt,
  'shippingAddress': aboxFixtures.order.shippingAddress,
  'total': aboxFixtures.order.total
};

const result = jt2.validate(OrderSummarySchema.$id, summary);

console.assert(result.ok);
console.assert(!('items' in summary));
