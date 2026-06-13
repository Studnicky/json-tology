/**
 * Transforms recipes — base64 string ↔ canonical UTF-8 text string
 *
 * Wire format: `string` with `contentEncoding: 'base64'`. Canonical:
 * UTF-8 text string. Decode base64 to text; encode re-encodes text to
 * base64. Uses Node's `Buffer` (available everywhere the bookstore tests
 * run); replace with `atob`/`btoa` on browser runtimes that lack `Buffer`.
 *
 * The payload is the UTF-8 text of "Bastian Balthazar Bux" —
 * the customer record's owner name — decoded from base64.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BinaryTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/Binary',
    'contentEncoding': 'base64',
    'type': 'string'
  } as const,
  {
    'decode': (wire: string) => {
      // Decode: base64 wire to canonical UTF-8 text string.
      return Buffer.from(wire, 'base64').toString('utf8');
    },
    'encode': (textString: string) => {
      // Encode: UTF-8 text string back to base64.
      return Buffer.from(textString).toString('base64');
    }
  }
);

jt.set(BinaryTransform);

const original = new TextEncoder().encode(aboxFixtures.customer.name);
const wire = Buffer.from(original).toString('base64');
const decoded = jt.instantiate(BinaryTransform, wire);

// Canonical is a UTF-8 text string.
console.assert(typeof decoded === 'string');
console.assert(decoded === aboxFixtures.customer.name);
// base64 of "Bastian Balthazar Bux"
console.log('wire (base64):', wire);
// 'Bastian Balthazar Bux' — decoded text
console.log('decoded text:', decoded);

const reEncoded = jt.encode(BinaryTransform, decoded);

console.assert(reEncoded === wire);
// true — text → base64
console.log('round-trip:', reEncoded === wire);
