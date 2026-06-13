/**
 * Money transform — integer cents ↔ decimal amount
 *
 * Storing money as integer cents avoids floating-point error. The
 * transform decodes the wire cents to a decimal number and encodes
 * back to cents on round-trip.
 */

import {
  Transform
} from '../../../src/index.js';
import {
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PriceCentsTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/PriceCents',
    'minimum': 0,
    'type': 'number'
  } as const,
  {
    'decode': (cents: number) => {
      return cents / 100;
    },
    'encode': (amount: number) => {
      return Math.round(amount * 100);
    }
  }
);

jt.set(PriceCentsTransform);

const wireCents = 1499;
const decoded = jt.instantiate(PriceCentsTransform, wireCents);

console.assert(decoded === 14.99);
// 1499
console.log('wire cents:', wireCents);
// 14.99 — no floating-point error
console.log('decoded decimal:', decoded);

const reEncoded = jt.encode(PriceCentsTransform, decoded);

console.assert(reEncoded === wireCents);
// 1499 — round-trip
console.log('re-encoded cents:', reEncoded);
