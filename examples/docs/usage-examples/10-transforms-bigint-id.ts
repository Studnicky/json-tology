/**
 * Transforms recipes — numeric identifier string ↔ canonical string
 *
 * The wire is a numeric string (e.g., ISBN-13). The canonical form
 * is also a string; decode validates the format and normalizes it
 * to canonical string form. This avoids BigInt entirely, keeping
 * the canonical value JSON-expressible.
 *
 * Registered as a sibling string primitive so a wire numeric string
 * can be normalized and validated without touching the canonical
 * `OrderIdSchema` (UUID).
 *
 * The wire is the numeric form of a hypothetical 64-bit catalogue id
 * for the 1979 Thienemann first edition of Die unendliche Geschichte.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BigIdTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/BigId',
    'pattern': '^\\d+$',
    'type': 'string'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode: validate and normalize numeric string to canonical form.
      // Verify it's a valid numeric string by attempting to parse as BigInt.
      BigInt(wire);

      return wire;
    },
    'encode': (value: string) => {
      // Encode: return the canonical string.
      return value;
    }
  }
);

jt.set(BigIdTransform);

const wire = '9783522128001';
const decoded = jt.instantiate(BigIdTransform, wire);

// Canonical is a string.
console.assert(typeof decoded === 'string');
console.assert(decoded === wire);
// '9783522128001' — ISBN-13 as string
console.log('wire string:', wire);
// '9783522128001' — canonical string
console.log('decoded id string:', decoded);

const reEncoded = jt.encode(BigIdTransform, decoded);

console.assert(reEncoded === wire);
// '9783522128001' — round-trip
console.log('re-encoded:', reEncoded);
