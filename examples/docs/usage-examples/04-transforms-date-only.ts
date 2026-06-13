/**
 * Date-only transform — `YYYY-MM-DD` string ↔ canonical date-only string
 *
 * Wire format `'YYYY-MM-DD'` (canonical `PublicationDateSchema` shape).
 * Decoder normalizes to a canonical ISO 8601 date-only string (YYYY-MM-DD).
 * Defines a schema with unique `$id` so it doesn't interfere with other examples.
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

const PublishedAtTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/PublishedAt',
    'pattern': '^\\d{4}-\\d{2}-\\d{2}$',
    'type': 'string'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode normalizes to canonical date-only string (YYYY-MM-DD).
      const date = new Date(`${wire}T00:00:00Z`);

      return date.toISOString().slice(0, 10);
    },
    'encode': (dateOnlyString: string) => {
      // Encode returns the wire value (already in YYYY-MM-DD format).
      return dateOnlyString;
    }
  }
);

jt.set(PublishedAtTransform);

const wire = aboxFixtures.rareBook.publishedOn;
const decoded = jt.instantiate(PublishedAtTransform, wire);

// Canonical is a date-only string.
console.assert(typeof decoded === 'string');
console.assert(decoded === wire);

// Check year by parsing the canonical string.
const date = new Date(`${decoded}T00:00:00Z`);

console.assert(date.getUTCFullYear() === 1979);
// '1979-09-01'
console.log('wire:', wire);
// 1979 — from canonical date-only string
console.log('decoded UTC year:', date.getUTCFullYear());

const reEncoded = jt.encode(PublishedAtTransform, decoded);

console.assert(reEncoded === wire);
// '1979-09-01' — round-trip
console.log('round-trip:', reEncoded);
