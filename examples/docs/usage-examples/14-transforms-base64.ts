/**
 * Transforms recipes — base64 string ↔ Uint8Array
 *
 * Wire format: `string` with `contentEncoding: 'base64'`. Decoded
 * type: `Uint8Array`. Uses Node's `Buffer` (available everywhere
 * the bookstore tests run); replace with `atob`/`btoa` on browser
 * runtimes that lack `Buffer`.
 *
 * The payload is the UTF-8 bytes of "Bastian Balthazar Bux" —
 * the customer record's owner name — round-tripped through base64.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BinarySchema = {
  '$id': 'https://bookstore.example/Binary',
  'contentEncoding': 'base64',
  'type': 'string'
} as const;

jt.set(BinarySchema);

const BinaryTransform = Transform.create<typeof BinarySchema, Uint8Array>(BinarySchema, {
  'decode': (wire) => {
    return new Uint8Array(Buffer.from(wire, 'base64'));
  },
  'encode': (bytes) => {
    return Buffer.from(bytes).toString('base64');
  }
});

const original = new TextEncoder().encode(aboxFixtures.customer.name);
const wire = Buffer.from(original).toString('base64');
const decoded = jt.instantiate(BinaryTransform, wire);

if (!(decoded instanceof Uint8Array)) {
  throw new TypeError('Binary transform did not return a Uint8Array');
}

console.assert(new TextDecoder().decode(decoded) === aboxFixtures.customer.name);

const reEncoded = jt.encode(BinaryTransform, decoded);

console.assert(reEncoded === wire);
