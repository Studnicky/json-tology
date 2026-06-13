/**
 * Transforms recipes — Example 1: ISO 8601 decoder/encoder round-trip
 *
 * Defines a date-string ↔ ISO 8601 canonical transform. The canonical schema is
 * a string in `format: 'date-time'`, matching the bookstore's `Iso8601Schema` but
 * with a unique `$id` so this transform doesn't interfere with other examples.
 *
 * The wire value is `aboxFixtures.order.placedAt`: the moment Bastian
 * Balthazar Bux placed the order for the 1979 Thienemann first edition.
 * Decode normalizes to canonical ISO 8601 string; encode reverses.
 */

import {
  Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PlacedAtTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/PlacedAt',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode normalizes the wire value to canonical ISO 8601 string.
      return new Date(wire).toISOString();
    },
    'encode': (isoString: string) => {
      // Encode returns the wire value (ISO string).
      return isoString;
    }
  }
);

jt.set(PlacedAtTransform);

const wire: string = aboxFixtures.order.placedAt;
const decoded = jt.instantiate(PlacedAtTransform, wire);

// Canonical is an ISO 8601 string.
console.assert(typeof decoded === 'string');
console.assert(decoded === new Date(aboxFixtures.order.placedAt).toISOString());

// Check year and month by parsing the canonical string.
const date = new Date(decoded);

console.assert(date.getUTCFullYear() === 2026);
// April is month 3 (0-indexed)
console.assert(date.getUTCMonth() === 3);
// ISO string form of the canonical value
console.log('decoded canonical (ISO):', decoded);
// 2026 3 — extracted from canonical string
console.log('year / month:', date.getUTCFullYear(), date.getUTCMonth());

const reEncoded = jt.encode(PlacedAtTransform, decoded);

console.assert(typeof reEncoded === 'string');
// Canonical round-trip: encode(decode(x)) reproduces the normalized canonical form.
console.assert(reEncoded === decoded);
// Semantic round-trip: the time instant is preserved even if milliseconds differ.
console.assert(new Date(reEncoded).getTime() === date.getTime());
// Note: wire ≠ reEncoded due to millisecond normalization in canonical form
console.log('round-trip lossless (semantic):', new Date(reEncoded).getTime() === new Date(wire).getTime());
