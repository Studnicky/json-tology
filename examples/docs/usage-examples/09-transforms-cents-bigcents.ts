/**
 * Transforms recipes — integer cents ↔ a precision-safe BigCents value
 *
 * Storing money as integer cents avoids floating-point error. The
 * recipe in the docs uses an external `Decimal` library; this runnable
 * variant uses a built-in `bigint`-backed `BigCents` wrapper so the
 * example has no external dependency.
 *
 * Registered on a sibling of the canonical `AmountSchema` so the
 * canonical primitive stays a bare number.
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

class BigCents {
  public constructor(public readonly cents: bigint) {}

  public toMajorUnits(): number {
    return Number(this.cents) / 100;
  }
}

const BigCentsSchema = Compose.equivalent(
  AmountSchema,
  { '$id': 'https://bookstore.example/BigCents' } as const
);

jt.set(BigCentsSchema);

Transform.create<typeof BigCentsSchema, BigCents>(BigCentsSchema, {
  'decode': (cents) => {
    return new BigCents(BigInt(cents));
  },
  'encode': (value) => {
    return Number(value.cents);
  }
});

const wireCents = 85_000;
const decoded = jt.instantiate(BigCentsSchema, wireCents);

if (!(decoded instanceof BigCents)) {
  throw new TypeError('BigCents transform did not return a BigCents');
}

console.assert(decoded.toMajorUnits() === 850);

const reEncoded = jt.encode(BigCentsSchema, decoded);

console.assert(reEncoded === wireCents);
