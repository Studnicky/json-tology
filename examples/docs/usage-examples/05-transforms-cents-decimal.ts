/**
 * Money transform — integer cents ↔ decimal amount
 *
 * Storing money as integer cents avoids floating-point error. The
 * transform decodes the wire cents to a decimal number and encodes
 * back to cents on round-trip. Registered on a `Compose.equivalent`
 * sibling of the canonical `AmountSchema` so the canonical primitive
 * stays free of leaked transforms.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  AmountSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PriceCentsSchema = Compose.equivalent(AmountSchema, { '$id': 'https://bookstore.example/PriceCents' } as const);

jt.set(PriceCentsSchema);

const PriceCentsTransform = Transform.create<typeof PriceCentsSchema, number>(PriceCentsSchema, {
  'decode': (cents) => {
    return (cents as number) / 100;
  },
  'encode': (amount) => {
    return Math.round(amount * 100);
  }
});

const wireCents = 1499;
const decoded = jt.instantiate(PriceCentsTransform, wireCents);

console.assert(decoded === 14.99);

const reEncoded = jt.encode(PriceCentsTransform, decoded);

console.assert(reEncoded === wireCents);
