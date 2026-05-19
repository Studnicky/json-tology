/**
 * Transforms recipes — Unix epoch milliseconds ↔ Date
 *
 * Wire format: integer milliseconds since the epoch. Decoded type: Date.
 * Defined as a sibling integer primitive registered against
 * `bookstoreEntities` so the canonical `Iso8601Schema` (string form)
 * continues to carry the RFC 3339 shape.
 *
 * The wire value is Bastian Balthazar Bux's order timestamp recast as
 * epoch ms — the same scenario as `03-transforms-recipes.ts`, expressed
 * in a different wire encoding.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const TimestampSchema = {
  '$id': 'https://bookstore.example/Timestamp',
  'minimum': 0,
  'type': 'integer'
} as const;

jt.set(TimestampSchema);

Transform.create<typeof TimestampSchema, Date>(TimestampSchema, {
  'decode': (wire) => {
    return new Date(wire);
  },
  'encode': (date) => {
    return date.getTime();
  }
});

const wireMs = new Date(aboxFixtures.order.placedAt).getTime();
const decoded = jt.instantiate(TimestampSchema, wireMs);

if (!(decoded instanceof Date)) {
  throw new TypeError('Timestamp transform did not return a Date');
}

console.assert(decoded.getUTCFullYear() === 2026);

const reEncoded = jt.encode(TimestampSchema, decoded);

console.assert(reEncoded === wireMs);
