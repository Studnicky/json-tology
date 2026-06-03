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
import type { BookstoreRefs } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const OrderSummarySchema = Compose.omit(
  OrderSchema,
  ['orderLines'] as const,
  'https://bookstore.example/OrderSummary'
);

type OrderSummary = InferType<typeof OrderSummarySchema, BookstoreRefs>;

const jt2 = jt.set(OrderSummarySchema);

// Instantiate the full order to get branded field values, then project the
// OrderSummary view (every field except orderLines) from them.
const order = jt2.instantiate(OrderSchema.$id, aboxFixtures.order);
const summary: OrderSummary = {
  'customerId': order.customerId,
  'orderId': order.orderId,
  'orderTotal': order.orderTotal,
  'placedAt': order.placedAt,
  'shippingAddress': order.shippingAddress
};

const result = jt2.validate(OrderSummarySchema.$id, summary);

console.assert(result.ok);
console.assert(!('orderLines' in summary));
console.log('OrderSummary fields:', Object.keys(summary), '| orderLines omitted:', !('orderLines' in summary));
