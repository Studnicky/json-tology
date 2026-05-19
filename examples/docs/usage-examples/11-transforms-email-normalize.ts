/**
 * Transforms recipes — email normalization (lowercase + trim)
 *
 * Validation alone does not normalize. The decoder canonicalizes the
 * incoming wire string; the encoder is the identity so the wire form
 * preserves whatever the decoder produced. Registered as a sibling
 * email primitive against `bookstoreEntities` so the canonical
 * `EmailSchema` stays free of leaked transforms.
 *
 * The fixture is Bastian Balthazar Bux's email, fed in with stray
 * whitespace and mixed case to demonstrate the normalization.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Wire format does NOT include the 'email' format check — the whole
// point of the transform is to normalize whitespace and casing before
// the value reaches the canonical EmailSchema. Downstream consumers
// can ref the canonical schema once the decoded value is in hand.
const NormalizedEmailSchema = {
  '$id': 'https://bookstore.example/NormalizedEmail',
  'type': 'string'
} as const;

jt.set(NormalizedEmailSchema);

Transform.create<typeof NormalizedEmailSchema, string>(NormalizedEmailSchema, {
  'decode': (raw) => {
    return raw.trim().toLowerCase();
  },
  'encode': (clean) => {
    return clean;
  }
});

const wire = `  ${aboxFixtures.customer.email.toUpperCase()}  `;
const decoded = jt.instantiate(NormalizedEmailSchema, wire);

console.assert(decoded === aboxFixtures.customer.email);

const reEncoded = jt.encode(NormalizedEmailSchema, aboxFixtures.customer.email);

console.assert(reEncoded === aboxFixtures.customer.email);
