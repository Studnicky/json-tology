/**
 * Registry-level defaults vs per-call overrides for iriFor / iriForFunction / graphIri.
 *
 * JsonTology.create accepts the same iriFor / iriForFunction / defaultGraphIri
 * options as the toQuads call site. Per-call overrides win when both are set.
 *
 * The bookstoreEntities registry is created without those defaults, so
 * here we exercise the override path explicitly. The shape of the
 * options object is identical at the create() and toQuads() boundaries.
 */

import { Skolemize } from '../../../src/index.js';
import type { JsonTologyOptionsInterface } from '../../../src/interfaces/JsonTologyOptionsInterface.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Type-level proof: the same options shape applies at create() time.
const registryDefaults: Pick<
  JsonTologyOptionsInterface,
  'defaultDeskolemize' | 'defaultGraphIri' | 'iriForFunction'
> = {
  'defaultDeskolemize': true,
  'defaultGraphIri': 'https://shop.example.com/graphs/main',
  'iriForFunction': Skolemize.wellKnownGenid('https://shop.example.com')
};

void registryDefaults;

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

// Per-call override wins over any registry default. Here we use the
// existing registry (no defaults set) and override at the call site.
const named = bookstoreEntities.toQuads(OrderSchema, order, { 'iriFor': 'https://shop.example.com/orders/A-1234' });

console.assert(named.length > 0, 'per-call iriFor override emitted quads');
console.assert(
  named.some((quad) => {
    return quad.subject.value === 'https://shop.example.com/orders/A-1234';
  }),
  'root subject reflects the per-call override'
);
console.log('per-call override root IRI:', named[0]?.subject.value);
