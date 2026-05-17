/**
 * Transform.create / encode — Example 1: ISO datetime ↔ Date round-trip
 * Demonstrates: decode on coerce, encode reversal, InstantiationError on invalid input
 *
 * The transform schema registers onto the canonical bookstore via
 * `bookstoreEntities.set()`. The decoded value is the moment Bastian
 * Balthazar Bux placed his order for the 1979 Neverending Story from
 * Coreander's antiquariat — `aboxFixtures.order.placedAt`.
 */

import {
  InstantiationError, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities
} from '../bookstore/index.js';

const PlacedAtSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/PlacedAt',
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

bookstoreEntities.set(PlacedAtSchema);

// Wire → Domain. Note: the canonical fixture timestamp lacks ms; we use
// the millisecond-precision form here so the encode round-trip is exact.
const raw = '2026-04-12T14:23:11.000Z';
const decoded = bookstoreEntities.instantiate(PlacedAtSchema.$id, raw);

if (!(decoded instanceof Date)) {
  throw new TypeError('Iso8601 transform did not return a Date');
}

const date: Date = decoded;

console.assert(date.getFullYear() === 2026);
// Same instant as `aboxFixtures.order.placedAt`.
console.assert(date.toISOString() === new Date(aboxFixtures.order.placedAt).toISOString());

// Domain → Wire (encode reversal).
const wire = bookstoreEntities.encode(PlacedAtSchema, date);

console.assert(wire === raw);

// Invalid input still throws InstantiationError.
let threw = false;

try {
  bookstoreEntities.instantiate(PlacedAtSchema.$id, 'not-a-date');
} catch (error) {
  threw = error instanceof InstantiationError;
}
console.assert(threw);
