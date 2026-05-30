/**
 * Compose.omit — Example 2: Order summary without line items
 *
 * Drops the `orderLines` array from the canonical OrderSchema to produce a
 * compact summary suitable for dashboard rows. The derived type still
 * carries `orderId`, `customerId`, `orderTotal`, `placedAt`, and the shipping
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
  ['orderLines'] as const,
  'https://bookstore.example/OrderSummary'
);

type OrderSummary = InferType<typeof OrderSummarySchema>;

const jt2 = jt.set(OrderSummarySchema);

const summary: OrderSummary = {
  'customerId': aboxFixtures.order.customerId,
  'orderId': aboxFixtures.order.orderId,
  'orderTotal': aboxFixtures.order.orderTotal,
  'placedAt': aboxFixtures.order.placedAt,
  'shippingAddress': aboxFixtures.order.shippingAddress
};

const result = jt2.validate(OrderSummarySchema.$id, summary);

console.assert(result.ok);
console.assert(!('orderLines' in summary));
console.log('OrderSummary fields:', Object.keys(summary), '| orderLines omitted:', !('orderLines' in summary));
