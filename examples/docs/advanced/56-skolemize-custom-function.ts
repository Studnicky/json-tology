/**
 * Custom iriForFunction — derive the root subject from a domain id.
 *
 * Returning undefined from a custom strategy falls through to the
 * default Skolemize.hash minter, so nested objects still receive
 * deterministic IRIs without explicit handling.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

const quads = bookstoreEntities.toQuads(OrderSchema, order, {
  // Mint at depth 0 from the value's `id` field; nested objects and
  // non-record values fall through to the default hash minter.
  'iriForFunction': (ctx) => {
    const isRootRecord = ctx.depth === 0 && typeof ctx.value === 'object' && ctx.value !== null;
    const id = isRootRecord ? (ctx.value as { 'orderId'?: string }).orderId : undefined;

    return typeof id === 'string'
      ? `https://shop.example.com/orders/${id}`
      : undefined;
  }
});

const rootIri = quads[0]?.subject.value ?? '';

console.assert(
  rootIri === `https://shop.example.com/orders/${aboxFixtures.order.orderId}`,
  `custom function minted root from id: ${rootIri}`
);
console.log('custom function root IRI:', rootIri);
