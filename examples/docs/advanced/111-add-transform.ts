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
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [
    CurrencySchema,
    PriceCentsSchema
  ] as const
});

// ── Domain type ───────────────────────────────────────────────────────────

interface Money {
  'currency': string;
  'dollars': number;
}

// ── Register the transform ────────────────────────────────────────────────
// `input.currency` is typed `string` and `input.valueInCents` is typed
// `number` because `$ref: 'Currency'` resolved through TRefs.
const MoneyCodec = jt.addTransform(PriceCentsSchema, {
  'decode': (input): Money => {
    return {
      'currency': input.currency,
      'dollars': input.valueInCents / 100
    };
  },
  'encode': (money: Money): { 'currency': string;
    'valueInCents': number } => {
    return {
      'currency': money.currency,
      'valueInCents': Math.round(money.dollars * 100)
    };
  }
});

// ── instantiate: wire → domain ─────────────────────────────────────────────
const wire = {
  'currency': 'EUR',
  'valueInCents': 1999
};

const money = jt.instantiate(MoneyCodec, wire);

console.assert(money.dollars === 19.99, 'decoded dollars');
console.assert(money.currency === 'EUR', 'decoded currency');
console.log('Decoded:', money);

// ── encode: domain → wire ──────────────────────────────────────────────────
const reEncoded = jt.encode(MoneyCodec, money);

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
