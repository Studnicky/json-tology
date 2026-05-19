/**
 * jt.encode — Example 1: Round-trip a placement timestamp
 * Demonstrates: instantiate (wire → domain), encode (domain → wire), exact round-trip
 *
 * Uses the PlacedAt transform registered in the bookstore. The timestamp is the
 * moment Bastian Balthazar Bux placed their order for the 1979 Thienemann first
 * edition from Coreander's antiquariat.
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
      return new Date(isoString);
    },
    'encode': (dateValue: Date) => {
      return dateValue.toISOString();
    }
  }
);

jt.set(PlacedAtRoundTripSchema);

const raw = '2026-01-15T10:30:00.000Z';
const date = jt.instantiate(PlacedAtRoundTripSchema, raw);

if (!(date instanceof Date)) {
  throw new TypeError('Expected Date from decode');
}

const wire = jt.encode(PlacedAtRoundTripSchema, date);

console.assert(wire === raw);
console.assert(typeof wire === 'string');
