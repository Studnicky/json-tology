/**
 * dump — Example 4: Transform integration — encode applied automatically
 * Demonstrates: instantiate → dump round-trip applies the encode function
 *
 * A PlacedAt schema wraps a date-time string with a Date transform.
 * `instantiate` decodes the ISO string to a Date; `dump` re-encodes it back
 * to the original ISO string. The round-trip recovers the wire value exactly.
 *
 * The timestamp is the moment Bastian Balthazar Bux placed the order for
 * Michael Ende's 1979 Thienemann first edition from Coreander's antiquariat.
 */

import { Transform } from '../../../src/index.js';
import {
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PlacedAtDumpSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/PlacedAtDump',
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

jt.set(PlacedAtDumpSchema);

const raw = '2026-01-15T10:30:00.000Z';
const decoded = jt.instantiate(PlacedAtDumpSchema, raw);

// instantiate applies the decode function — result is a Date
console.assert(decoded instanceof Date, 'instantiate should decode string → Date');

// encode applies the encode function — result is the original ISO string
const wire = jt.encode(PlacedAtDumpSchema, decoded);

console.assert(wire === raw, 'encode should re-encode Date → original ISO string');
console.assert(typeof wire === 'string');
