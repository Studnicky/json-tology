/**
 * Transforms recipes — slug normalization
 *
 * Lowercase, strip non-alphanumerics, collapse spaces to dashes,
 * trim leading/trailing dashes. The encoder is the identity, so
 * the wire form keeps whatever the decoder produced. Registered
 * as a new string primitive against `bookstoreEntities`.
 *
 * The wire string is the human-readable title of the 1979
 * Thienemann first edition of Die unendliche Geschichte; the
 * slug is suitable for review URLs.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const SlugSchema = {
  '$id': 'https://bookstore.example/Slug',
  'type': 'string'
} as const;

jt.set(SlugSchema);

Transform.create<typeof SlugSchema, string>(SlugSchema, {
  'decode': (raw) => {
    return raw
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, '-')
      .replaceAll(/^-|-$/gu, '');
  },
  'encode': (clean) => {
    return clean;
  }
});

const wire = `  ${aboxFixtures.rareBook.title}!  `;
const slug = jt.instantiate(SlugSchema, wire);

console.assert(slug === 'die-unendliche-geschichte');

const reEncoded = jt.encode(SlugSchema, slug);

console.assert(reEncoded === slug);
