/**
 * Skolemize.compose — chain strategies; first non-undefined wins.
 *
 * Useful for per-class minting policies that fall back through a list
 * of preferences before defaulting to the hash strategy.
 *
 * aboxFixtures.customer has a `customerId` field, so the first composed
 * fromProperty('customerId') strategy wins. If the value lacks `customerId`, compose
 * advances to the next strategy in the chain.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const strategy = Skolemize.compose(
  Skolemize.fromProperty('customerId', { 'baseIri': 'https://shop.example.com/by-id' }),
  Skolemize.fromProperty('email', { 'baseIri': 'https://shop.example.com/by-email' }),
  Skolemize.hash({ 'baseIri': 'https://shop.example.com' })
);

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer, { 'iriFor': strategy });

const rootIri = quads[0]?.subject.value ?? '';

console.assert(
  rootIri === `https://shop.example.com/by-id/${aboxFixtures.customer.customerId}`,
  `composed strategy resolved through customerId property: ${rootIri}`
);
console.log('composed strategy root IRI:', rootIri);
