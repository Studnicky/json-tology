/**
 * jt.encode — Example 1: Round-trip a placement timestamp
 * Demonstrates: instantiate (wire → canonical), encode (canonical → wire), exact round-trip
 *
 * A normalize transform: decode turns a wire ISO string into the schema's canonical ISO form,
 * encode returns it to wire format. The timestamp is the moment Bastian Balthazar Bux placed
 * their order for the 1979 Thienemann first edition from Coreander's antiquariat.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PlacedAtRoundTripSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/PlacedAtRoundTrip',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (isoString: string) => {
      return new Date(isoString).toISOString();
    },
    'encode': (isoString: string) => {
      return isoString;
    }
  }
);

jt.set(PlacedAtRoundTripSchema);

const raw = '2026-01-15T10:30:00.000Z';
const canonical = jt.instantiate(PlacedAtRoundTripSchema, raw);

if (typeof canonical !== 'string') {
  throw new TypeError('Expected string from decode');
}

const wire = jt.encode(PlacedAtRoundTripSchema, canonical);

console.assert(wire === raw);
console.assert(typeof wire === 'string');
console.log('wire      :', raw);
console.log('canonical :', canonical);
// exact round-trip
console.log('re-encoded === wire:', wire === raw);
