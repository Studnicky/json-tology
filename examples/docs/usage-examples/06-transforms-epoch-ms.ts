/**
 * Transforms recipes — Unix epoch milliseconds ↔ canonical ISO 8601 string
 *
 * Wire format: integer milliseconds since the epoch. Canonical: ISO 8601 string.
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

const TimestampTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/Timestamp',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (wire: number) => {
      // Decode epoch ms (wire) to canonical ISO 8601 string.
      return new Date(wire).toISOString();
    },
    'encode': (isoString: string) => {
      // Encode canonical ISO string back to epoch ms (wire).
      return new Date(isoString).getTime();
    }
  }
);

jt.set(TimestampTransform);

const wireMs = new Date(aboxFixtures.order.placedAt).getTime();
const decoded = jt.instantiate(TimestampTransform, wireMs);

// Canonical is an ISO 8601 string.
console.assert(typeof decoded === 'string');

const date = new Date(decoded);

console.assert(date.getUTCFullYear() === 2026);
// epoch ms for the order timestamp
console.log('wire ms:', wireMs);
// same instant as placedAt, in canonical ISO form
console.log('decoded ISO:', decoded);

const reEncoded = jt.encode(TimestampTransform, decoded);

console.assert(reEncoded === wireMs);
// true — lossless
console.log('round-trip equal:', reEncoded === wireMs);
