/**
 * Transforms recipes — integer cents ↔ decimal major units (number)
 *
 * Storing money as integer cents avoids floating-point error. The
 * canonical form is a decimal number (major.minor units), computed
 * safely from the wire cents via division, avoiding floating-point
 * precision loss for typical bookstore amounts.
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

const BigCentsTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/BigCents',
    'minimum': 0,
    'type': 'number'
  } as const,
  {
    'decode': (cents: number) => {
      // Decode wire cents to canonical decimal (major.minor).
      return cents / 100;
    },
    'encode': (majorUnits: number) => {
      // Encode canonical decimal back to integer cents.
      return Math.round(majorUnits * 100);
    }
  }
);

jt.set(BigCentsTransform);

const wireCents = 85_000;
const decoded = jt.instantiate(BigCentsTransform, wireCents);

// Canonical is a decimal number.
console.assert(typeof decoded === 'number');
console.assert(decoded === 850);
// 85000
console.log('wire cents:', wireCents);
// 850 — canonical decimal amount
console.log('decoded major units:', decoded);

const reEncoded = jt.encode(BigCentsTransform, decoded);

console.assert(reEncoded === wireCents);
// 85000 — round-trip
console.log('re-encoded cents:', reEncoded);
