/**
 * dump — Example 4: Transform integration — encode applied automatically
 * Demonstrates: instantiate → dump round-trip applies the encode function
 *
 * A PlacedAt schema wraps a date-time string with a normalize transform.
 * `instantiate` decodes the ISO string (normalizing fractional milliseconds);
 * `dump` applies encode to re-serialize. The round-trip recovers the wire value exactly.
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
      // Normalize: parse and re-emit as canonical ISO string.
      // This ensures the wire value is normalized to a consistent format.
      return new Date(isoString).toISOString();
    },
    'encode': (isoString: string) => {
      // Encode reversal: return the canonical ISO string to wire.
      return isoString;
    }
  }
);

jt.set(PlacedAtDumpSchema);

const raw = '2026-01-15T10:30:00.000Z';
const canonical = jt.instantiate(PlacedAtDumpSchema, raw);

// instantiate applies the decode function — result is a canonical ISO string
console.assert(typeof canonical === 'string', 'instantiate should decode to ISO string');
console.assert(canonical === raw, 'canonical form matches raw input');

// encode applies the encode function — result is the original ISO string
const wire = jt.encode(PlacedAtDumpSchema, canonical);

console.assert(wire === raw, 'encode should re-encode canonical → original ISO string');
console.assert(typeof wire === 'string');

// Show the round-trip: ISO string → canonical ISO string → wire ISO string
console.log('raw ISO string:', raw);
console.log('canonical ISO string:', canonical);
console.log('re-encoded (wire):', wire);
