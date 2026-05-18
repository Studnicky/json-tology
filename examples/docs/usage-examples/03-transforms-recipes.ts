/**
 * Transforms recipes — Example 1: ISO 8601 decoder/encoder round-trip
 *
 * Registers a date-string ↔ Date transform on a `Compose.equivalent`
 * sibling of the canonical `Iso8601Schema`. The canonical schema is
 * left untouched so other examples that depend on the wire-string
 * shape (validation, dump, serialization) see no behaviour change.
 *
 * The wire value is `aboxFixtures.order.placedAt`: the moment Bastian
 * Balthazar Bux placed the order for the 1979 Thienemann first edition.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, createBookstoreDocRegistry,
  Iso8601Schema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PlacedAtSchema = Compose.equivalent(Iso8601Schema, { '$id': 'https://bookstore.example/PlacedAt' } as const);

jt.set(PlacedAtSchema);

Transform.create<typeof PlacedAtSchema, Date>(PlacedAtSchema, {
  'decode': (wire) => {
    return new Date(wire as string);
  },
  'encode': (date) => {
    return date.toISOString();
  }
});

const wire: string = aboxFixtures.order.placedAt;
const decoded = jt.instantiate(PlacedAtSchema, wire);

if (!(decoded instanceof Date)) {
  throw new TypeError('PlacedAt transform did not return a Date');
}

const date: Date = decoded;

console.assert(date.getUTCFullYear() === 2026);
// April is month 3 (0-indexed)
console.assert(date.getUTCMonth() === 3);

const reEncoded = jt.encode(PlacedAtSchema, date);

console.assert(typeof reEncoded === 'string');
// Round-trip equality on the wire-format precision.
console.assert(new Date(reEncoded as string).getTime() === date.getTime());
