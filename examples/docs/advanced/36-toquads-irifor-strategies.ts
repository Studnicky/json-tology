/**
 * Subject minting strategies via the iriFor option on toQuads.
 *
 * Demonstrates each of the four minting forms accepted by toQuads:
 *   1. Fixed root-only override (string IRI).
 *   2. Anonymous blank-node subjects (the 'blank-node' literal).
 *   3. Skolemize.fromProperty — mint from a value field.
 *   4. Skolemize.wellKnownGenid — W3C RDF 1.1 §3.5 reversible pattern.
 *   5. Custom function — receives { path, value, depth }.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

// 1. Root-only override (depth 0 wins; nested objects fall through):
const rootOverride = bookstoreEntities.toQuads(OrderSchema, order, { 'iriFor': 'https://shop.example.com/orders/A-1234' });

console.assert(rootOverride.length > 0, 'root override emitted quads');

// 2. Anonymous blank-node subjects for every emitted object:
const blankNodes = bookstoreEntities.toQuads(OrderSchema, order, { 'iriFor': 'blank-node' });

console.assert(blankNodes.length > 0, 'blank-node strategy emitted quads');

// 3. Mint from a property of the value (Customer has an id field):
const fromCustomerId = bookstoreEntities.toQuads(CustomerSchema, customer, { 'iriFor': Skolemize.fromProperty('customerId', { 'baseIRI': 'https://shop.example.com/customers' }) });

console.assert(fromCustomerId.length > 0, 'fromProperty strategy emitted quads');

// 4. W3C RDF 1.1 §3.5 well-known genid pattern (reversible by deskolemize):
const genid = bookstoreEntities.toQuads(OrderSchema, order, { 'iriFor': Skolemize.wellKnownGenid('https://shop.example.com') });

console.assert(genid.length > 0, 'wellKnownGenid strategy emitted quads');

// 5. Custom function: receives { path, value, depth }; return undefined to fall through.
const custom = bookstoreEntities.toQuads(OrderSchema, order, {
  'iriFor': (ctx) => {
    return ctx.depth === 0
      ? `https://shop.example.com/orders/${(ctx.value as { 'orderId': string }).orderId}`
      : undefined;
  }
});

console.assert(custom.length > 0, 'custom function strategy emitted quads');
