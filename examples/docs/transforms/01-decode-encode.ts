/**
 * Transform.create / localJt.encode — Example 1: ISO datetime ↔ Date round-trip
 * Demonstrates: decode on coerce, encode reversal, InstantiationError on invalid input
 */

import {
  InstantiationError, JsonTology, Transform
} from '../../../src/index.js';

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

const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [PlacedAtSchema] as const
});

// Wire → Domain
const raw = '2026-01-15T10:30:00.000Z';
const date = localJt.instantiate(PlacedAtSchema.$id, raw);

console.assert(date instanceof Date);
console.assert((date).getFullYear() === 2026);

// Domain → Wire (encode reversal)
const wire = localJt.encode(PlacedAtSchema, date);

console.assert(wire === raw);

// Invalid input still throws InstantiationError
let threw = false;

try {
  localJt.instantiate(PlacedAtSchema.$id, 'not-a-date');
} catch (error) {
  threw = error instanceof InstantiationError;
}
console.assert(threw);
