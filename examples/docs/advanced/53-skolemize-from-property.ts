/**
 * Skolemize.fromProperty — mint subject IRIs from a value property.
 *
 * Reads `value[name]` when it is a non-empty string and emits
 * `<baseIRI>/<value[name]>`. Otherwise delegates to the fallback
 * (defaults to Skolemize.hash), so heterogeneous instance trees still
 * produce IRIs for every object.
 *
 * Bastian Balthazar Bux's customer record has a `customerId` field, so the
 * minter resolves the root subject from that property directly.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer, { 'iriFor': Skolemize.fromProperty('customerId', { 'baseIRI': 'https://shop.example.com/customers/by-id' }) });

const rootIri = quads[0]?.subject.value ?? '';

console.assert(
  rootIri === `https://shop.example.com/customers/by-id/${aboxFixtures.customer.customerId}`,
  `root IRI minted from customerId property: ${rootIri}`
);
