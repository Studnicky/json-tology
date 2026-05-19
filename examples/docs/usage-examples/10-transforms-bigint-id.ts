/**
 * Transforms recipes — stringified BigInt identifier
 *
 * JSON cannot natively represent `BigInt`. Stringify on the wire;
 * parse on decode. Registered as a sibling string primitive on
 * `bookstoreEntities` so a wire-stringified `BigInt` round-trips
 * losslessly without touching the canonical `OrderIdSchema` (UUID).
 *
 * The wire is the numeric form of a hypothetical 64-bit catalogue id
 * for the 1979 Thienemann first edition of Die unendliche Geschichte.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BigIdSchema = {
  '$id': 'https://bookstore.example/BigId',
  'pattern': '^\\d+$',
  'type': 'string'
} as const;

jt.set(BigIdSchema);

Transform.create<typeof BigIdSchema, bigint>(BigIdSchema, {
  'decode': BigInt,
  'encode': (value) => {
    return value.toString();
  }
});

const wire = '9783522128001';
const decoded = jt.instantiate(BigIdSchema, wire);

console.assert(typeof decoded === 'bigint');
console.assert(decoded === 9_783_522_128_001n);

const reEncoded = jt.encode(BigIdSchema, decoded);

console.assert(reEncoded === wire);
