/**
 * OWL restrictions — Chaining min and max cardinality
 *
 * Each `Compose.subClassOf` call appends a restriction blank node to
 * the body's `jt:restrictions`. Chaining the minCardinality(1) and
 * maxCardinality(2) restrictions onto an Adult class produces two
 * `owl:Restriction` blank nodes attached via `rdfs:subClassOf`.
 *
 * Demonstrates the chain composition shape used by the bookstore's
 * `RareBookSchema` (which layers `someValuesFrom` and
 * `maxCardinality` on `authors`).
 */

import { Compose } from '../../../src/index.js';

const PARENT_PROP = 'urn:example:parent';

const AdultSchema = Compose.subClassOf(
  Compose.minCardinality(PARENT_PROP, 1),
  Compose.subClassOf(
    Compose.maxCardinality(PARENT_PROP, 2),
    {
      '$id': 'urn:example:Adult',
      'type': 'object'
    } as const
  )
);

const adultId: string = AdultSchema.$id;

console.assert(adultId.endsWith('Adult'));
console.log('Adult schema with chained min/max cardinality restrictions:', adultId);
console.log('restrictions:', (AdultSchema as Record<string, unknown>)['jt:restrictions']);
