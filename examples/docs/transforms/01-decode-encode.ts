/**
 * Transform.create / encode — Example 1: raw date string ↔ canonical ISO
 * Demonstrates: decode normalizes wire → canonical, encode reversal, DecodeError
 * on malformed input.
 *
 * A normalize transform's `decode` turns the raw wire value into the schema's
 * canonical form; the schema describes decode's OUTPUT, so validation runs on
 * the decoded result (decode → validate → strip). The canonical value is the
 * moment Bastian Balthazar Bux placed their order for the 1979 Neverending
 * Story from Coreander's antiquariat — `aboxFixtures.order.placedAt`.
 */

import {
  DecodeError, Transform
} from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PlacedAtSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/PlacedAt',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    // Wire (a raw date string) → canonical ISO date-time string. A malformed
    // input fails inside decode, before validation, surfacing a DecodeError.
    'decode': (raw: string) => {
      return new Date(raw).toISOString();
    },
    'encode': (isoString) => {
      return isoString;
    }
  }
);

jt.set(PlacedAtSchema);

// Wire → canonical. The decoded value is the canonical ISO date-time string.
const raw = '2026-04-12T14:23:11.000Z';
const decoded = jt.instantiate(PlacedAtSchema, raw);

console.assert(typeof decoded === 'string');
// Same instant as `aboxFixtures.order.placedAt`.
console.assert(decoded === new Date(aboxFixtures.order.placedAt).toISOString());

// decoded: 2026-04-12T14:23:11.000Z
console.log('decoded :', decoded);

// Canonical → wire (encode reversal).
const wire = jt.encode(PlacedAtSchema, decoded);

console.assert(wire === raw);
// encoded: 2026-04-12T14:23:11.000Z (exact round-trip)
console.log('encoded :', wire);

// Malformed input fails inside decode → DecodeError.
let threw = false;

try {
  // PlacedAtSchema was registered at runtime via set(), so it is not part of
  // the registry's compile-time schema-ID union — pass the schema object.
  jt.instantiate(PlacedAtSchema, 'not-a-date');
} catch (error) {
  threw = error instanceof DecodeError;
}
console.assert(threw);
console.log('malformed input threw DecodeError:', threw);
