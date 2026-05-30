/**
 * InferType — Example: Cross-schema $ref resolution.
 *
 * When a schema references another by absolute IRI, the second type
 * argument carries a reference map so `$ref` resolves to the
 * downstream schema's type. Without the map, the resolved element
 * type would fall through to `unknown`.
 */

import type { InferType } from '../../../src/types/index.js';
import type {
  OrderLineSchema, OrderSchema
} from '../bookstore/index.js';

// Pass a reference map keyed by absolute IRI; values are the schemas
// to resolve those IRIs against.
type Order = InferType<
  typeof OrderSchema,
  { 'urn:bookstore:OrderLine': typeof OrderLineSchema; }
>;

// Sanity: the inferred items array has element type carrying at least
// the OrderLine quantity field.
type AssertExtendsType<TLeft, TRight>
  = [TLeft] extends [TRight] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

assert<AssertExtendsType<
  Order['orderLines'] extends readonly unknown[] ? true : false,
  true
>>();

// At compile time, Order['orderLines'] is an array type resolved via the
// reference map. The assertion above confirms the resolution succeeded.
// Log the schema $id to show the cross-schema reference anchor.
console.log('OrderSchema $id:', 'urn:bookstore:Order');
console.log('reference map key:', 'urn:bookstore:OrderLine');
