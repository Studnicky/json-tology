/**
 * Transforms recipes — URL string ↔ URL object
 *
 * Wire format: `string` with `format: 'uri'`. Decoded type: native
 * `URL`. Registered as a new string primitive against
 * `bookstoreEntities` so callers can decode catalogue links straight
 * to `URL` instances.
 *
 * The wire is the catalogue page for the 1979 Thienemann first
 * edition of Die unendliche Geschichte that Bastian ordered.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const HrefSchema = {
  '$id': 'https://bookstore.example/Href',
  'format': 'uri',
  'type': 'string'
} as const;

jt.set(HrefSchema);

const HrefTransform = Transform.create<typeof HrefSchema, URL>(HrefSchema, {
  'decode': (wire) => {
    return new URL(wire);
  },
  'encode': (url) => {
    return url.toString();
  }
});

const wire = `https://bookstore.example/catalogue/${aboxFixtures.rareBook.isbn}`;
const decoded = jt.instantiate(HrefTransform, wire);

if (!(decoded instanceof URL)) {
  throw new TypeError('Href transform did not return a URL');
}

console.assert(decoded.pathname.endsWith(aboxFixtures.rareBook.isbn));
// 'bookstore.example'
console.log('decoded hostname:', decoded.hostname);
// '/catalogue/<isbn>'
console.log('decoded pathname:', decoded.pathname);

const reEncoded = jt.encode(HrefTransform, decoded);

console.assert(reEncoded === wire);
// true — URL.toString() is the identity
console.log('round-trip:', reEncoded === wire);
