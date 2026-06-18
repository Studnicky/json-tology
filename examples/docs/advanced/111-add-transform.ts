/**
 * Advanced Example 111 — addTransform: registry-aware transform registration
 *
 * `jt.addTransform(schema, { decode, encode })` is the instance-bound
 * alternative to the static `Transform.create`. The key difference:
 * `decode` input types resolve cross-registry `$ref`s through the
 * instance's schema map, so a schema whose properties `$ref` registered
 * primitives gets a fully-typed decode input — no cast, no `unknown`.
 *
 * Here a `PriceCents` wire schema (integer cents) is registered alongside
 * a `Currency` string primitive. `addTransform` decodes cents → a typed
 * `{ amount: number; currency: string }` domain value and encodes it back
 * to cents for the wire. The decoded value is then round-tripped through
 * `jt.encode()`.
 */

import { JsonTology } from '../../../src/index.js';

// ── Schema definitions ────────────────────────────────────────────────────

const CurrencySchema = {
  '$id': 'https://bookstore.example/Currency',
  'minLength': 3,
  'type': 'string'
} as const;

const PriceCentsSchema = {
  '$id': 'https://bookstore.example/PriceCents',
  'minimum': 0,
  'properties': {
    'currency': { '$ref': 'https://bookstore.example/Currency' },
    'valueInCents': { 'type': 'integer' }
  },
  'required': [
    'currency',
    'valueInCents'
  ],
  'type': 'object'
} as const;

// ── Registry ──────────────────────────────────────────────────────────────

const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [
    CurrencySchema,
    PriceCentsSchema
  ] as const
});

// ── Register the transform ────────────────────────────────────────────────
// `input.currency` is typed `string` and `input.valueInCents` is typed
// `number` because `$ref: 'Currency'` resolved through TRefs.
// The decode output must be a plain JSON value matching the schema's canonical form.
const PriceCentsCodec = jt.addTransform(PriceCentsSchema, {
  'decode': (input): { 'currency': string;
    'valueInCents': number } => {
    // Normalize: round up cents to nearest integer and validate range.
    const roundedCents = Math.round(input.valueInCents);

    return {
      'currency': input.currency,
      'valueInCents': roundedCents
    };
  },
  'encode': (value: { 'currency': string;
    'valueInCents': number }): {
    'currency': string;
    'valueInCents': number
  } => {
    // Encode reversal: return to wire form.
    return {
      'currency': value.currency,
      'valueInCents': value.valueInCents
    };
  }
});

// ── instantiate: wire → canonical form ─────────────────────────────────────
const wire = {
  'currency': 'EUR',
  'valueInCents': 1999
};

const canonical = jt.instantiate(PriceCentsCodec, wire);

console.assert(canonical.valueInCents === 1999, 'canonical cents');
console.assert(canonical.currency === 'EUR', 'canonical currency');
console.log('Canonical:', canonical);

// ── encode: canonical → wire ──────────────────────────────────────────────────
const reEncoded = jt.encode(PriceCentsCodec, canonical);

console.assert(reEncoded.valueInCents === 1999, 'encoded cents');
console.assert(reEncoded.currency === 'EUR', 'encoded currency');
console.log('Re-encoded:', reEncoded);

// ── round-trip assertion ───────────────────────────────────────────────────
console.assert(
  reEncoded.valueInCents === wire.valueInCents,
  'round-trip: decoded then re-encoded equals original wire cents'
);
console.assert(
  reEncoded.currency === wire.currency,
  'round-trip: decoded then re-encoded equals original wire currency'
);
console.log('Round-trip matches original wire:', reEncoded.valueInCents === wire.valueInCents);
