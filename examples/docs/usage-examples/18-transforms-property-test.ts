/**
 * Transforms recipes — round-trip property test pattern
 *
 * A transform is lossless when `encode(decode(x)) === x` and
 * `decode(encode(y)) === y` for every value in the domain. This
 * file demonstrates the property-test pattern against the
 * `PlacedAt` transform registered in `03-transforms-recipes.ts`
 * — the ISO 8601 ↔ Date pair.
 *
 * The samples include the canonical Bastian-order timestamp and
 * two neighbouring instants to exercise non-trivial inputs.
 */

import { strict as assert } from 'node:assert';
import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  Iso8601Schema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const RoundTripPlacedAtSchema = Compose.equivalent(
  Iso8601Schema,
  { '$id': 'https://bookstore.example/RoundTripPlacedAt' } as const
);

jt.set(RoundTripPlacedAtSchema);

Transform.create<typeof RoundTripPlacedAtSchema, Date>(RoundTripPlacedAtSchema, {
  'decode': (wire) => {
    return new Date(wire);
  },
  'encode': (date) => {
    return date.toISOString();
  }
});

function roundTrip<T extends { readonly '$id': string }>(
  schema: T,
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

roundTrip(RoundTripPlacedAtSchema, [
  normalizedPlacedAt,
  '2026-01-15T10:30:00.000Z',
  '1979-09-01T00:00:00.000Z'
]);

console.assert(true);
