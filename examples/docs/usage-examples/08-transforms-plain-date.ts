/**
 * Transforms recipes — calendar date primitive (PlainDate analogue)
 *
 * Wire format: `'YYYY-MM-DD'`. Canonical: date-only string with parsed
 * components recorded for later use. Demonstrates a transform that
 * decodes to a canonical object shape (JSON-expressible).
 *
 * The canonical form is a plain object with year, month, day fields,
 * suitable for JSON serialization and further processing. This mirrors
 * the structure Temporal.PlainDate provides, but expressed as a
 * canonical JSON object instead of a class instance.
 *
 * Registered on a sibling of the canonical `PublicationDateSchema`
 * (which itself decodes to date-only string in `04-transforms-date-only.ts`).
 * Bastian's rare 1979 first edition publication date is the wire
 * value.
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

interface PlainDateCanonical {
  readonly 'day': number;
  readonly 'month': number;
  readonly 'year': number;
}

function parseDate(wire: string): PlainDateCanonical {
  const [
    year,
    month,
    day
  ] = wire.split('-').map((part) => {
    return Number.parseInt(part, 10);
  }) as [number | undefined, number | undefined, number | undefined];

  if (year === undefined || month === undefined || day === undefined) {
    throw new TypeError(`parseDate: invalid wire '${wire}'`);
  }

  return {
    day,
    month,
    year
  };
}

function formatDate(date: PlainDateCanonical): string {
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');

  return `${String(date.year)}-${month}-${day}`;
}

const ReleaseDateTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/ReleaseDate',
    'properties': {
      'day': { 'type': 'number' },
      'month': { 'type': 'number' },
      'year': { 'type': 'number' }
    },
    'required': [
      'year',
      'month',
      'day'
    ],
    'type': 'object'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode to canonical plain object with year, month, day.
      return parseDate(wire);
    },
    'encode': (date: PlainDateCanonical) => {
      // Encode back to wire string format.
      return formatDate(date);
    }
  }
);

jt.set(ReleaseDateTransform);

const wire = aboxFixtures.rareBook.publishedOn;
const decoded = jt.instantiate(ReleaseDateTransform, wire);

// Canonical is a plain object with year, month, day.
console.assert(typeof decoded === 'object');
const plainDate = decoded;

console.assert(plainDate.year === 1979);
console.assert(plainDate.month === 9);
console.assert(plainDate.day === 1);
// '1979-09-01'
console.log('wire:', wire);
// 1979 9 1 — no time zone
console.log('PlainDate:', plainDate.year, plainDate.month, plainDate.day);

const reEncoded = jt.encode(ReleaseDateTransform, plainDate);

console.assert(reEncoded === wire);
// '1979-09-01' — round-trip
console.log('re-encoded:', reEncoded);
