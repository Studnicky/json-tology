/**
 * Transforms recipes — URL string ↔ canonical normalized URL string
 *
 * Wire format: `string` with `format: 'uri'`. Canonical: normalized
 * URL string. Decode validates and normalizes the URL by parsing and
 * re-stringifying it, ensuring consistent formatting and validity.
 * Registered as a new string primitive against
 * `bookstoreEntities` so callers can validate and normalize catalogue
 * links.
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

const HrefTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/Href',
    'format': 'uri',
    'type': 'string'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode: parse URL to validate, then normalize via toString().
      const url = new URL(wire);

      return url.toString();
    },
    'encode': (canonicalUrlString: string) => {
      // Encode: return the canonical URL string.
      return canonicalUrlString;
    }
  }
);

jt.set(HrefTransform);

const wire = `https://bookstore.example/catalogue/${aboxFixtures.rareBook.isbn}`;
const decoded = jt.instantiate(HrefTransform, wire);

// Canonical is a normalized URL string.
console.assert(typeof decoded === 'string');

const url = new URL(decoded);

console.assert(url.pathname.endsWith(aboxFixtures.rareBook.isbn));
// 'bookstore.example'
console.log('decoded hostname:', url.hostname);
// '/catalogue/<isbn>'
console.log('decoded pathname:', url.pathname);

const reEncoded = jt.encode(HrefTransform, decoded);

console.assert(reEncoded === wire);
// true — string round-trip
console.log('round-trip:', reEncoded === wire);
