/**
 * Transforms recipes — round-trip property test pattern
 *
 * A transform is lossless when `encode(decode(x)) === x` and
 * `decode(encode(y)) === y` for every value in the domain. This
 * file demonstrates the property-test pattern against the
 * `PlacedAt` transform registered in `03-transforms-recipes.ts`
 * — the ISO 8601 string ↔ canonical ISO 8601 string pair.
 *
 * The samples include the canonical Bastian-order timestamp and
 * two neighbouring instants to exercise non-trivial inputs.
 */

import {
  Transform
} from '../../../src/index.js';
import type { TransformedType } from '../../../src/types/Transform.js';
import {
  aboxFixtures, createBookstoreDocRegistry
} from '../bookstore/index.js';

// Browser-safe strict equality assertion (same shape as node:assert.strict),
// so this property test runs anywhere, not just under Node.
const assert = {
  equal(actual: unknown, expected: unknown, message?: string): void {
    if (actual !== expected) {
      throw new Error(message ?? `expected ${String(actual)} to equal ${String(expected)}`);
    }
  }
};

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const RoundTripPlacedAtTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/RoundTripPlacedAt',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode: normalize any ISO 8601 input to canonical Date.toISOString() form.
      return new Date(wire).toISOString();
    },
    'encode': (isoString: string) => {
      // Encode: return the canonical ISO string.
      return isoString;
    }
  }
);

jt.set(RoundTripPlacedAtTransform);

function roundTrip(
  schema: TransformedType<
    {
      readonly '$id': 'https://bookstore.example/RoundTripPlacedAt';
      readonly 'format': 'date-time';
      readonly 'type': 'string';
    },
    string
  >,
  samples: readonly string[]
): void {
  for (const wire of samples) {
    const decoded = jt.instantiate(schema, wire);
    const reEncoded = jt.encode(schema, decoded);

    assert.equal(reEncoded, wire);
  }
}

// Each sample is already in the canonical Date.toISOString() form,
// so encode(decode(x)) === x exactly. The bookstore fixture timestamp
// is normalized to the same form for the round-trip.
const normalizedPlacedAt = new Date(aboxFixtures.order.placedAt).toISOString();

const samples = [
  normalizedPlacedAt,
  '2026-01-15T10:30:00.000Z',
  '1979-09-01T00:00:00.000Z'
];

roundTrip(RoundTripPlacedAtTransform, samples);

console.log('round-trip samples checked:', samples.length);
console.log('all encode(decode(x)) === x:', true);
