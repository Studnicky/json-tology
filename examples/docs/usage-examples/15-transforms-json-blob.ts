/**
 * Transforms recipes — JSON string ↔ parsed object
 *
 * Wire format: JSON string. Canonical: parsed JavaScript object.
 * The schema describes the canonical form (the parsed object).
 * If callers want the decoded value to be more strictly validated,
 * register the object schema separately and use a `$ref` rather
 * than a generic `unknown` type.
 *
 * The payload is a serialized snapshot of the rare-book record
 * Bastian ordered — the same object as `aboxFixtures.rareBook`.
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const JsonBlobTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/JsonBlob',
    'additionalProperties': true,
    'type': 'object'
  } as const,
  {
    'decode': (wire: string) => {
      return JSON.parse(wire) as Record<string, unknown>;
    },
    'encode': (value: Record<string, unknown>) => {
      return JSON.stringify(value);
    }
  }
);

jt.set(JsonBlobTransform);

const wire = JSON.stringify(aboxFixtures.rareBook);
const decoded = jt.instantiate(JsonBlobTransform, wire);

console.assert(typeof decoded === 'object');
console.assert((decoded as { 'isbn': string }).isbn === aboxFixtures.rareBook.isbn);
// same ISBN as fixture
console.log('decoded isbn:', (decoded as { 'isbn': string }).isbn);
// 'object' — JSON.parse returns the structure
console.log('decoded type:', typeof decoded);

const reEncoded = jt.encode(JsonBlobTransform, decoded);

console.assert(reEncoded === wire);
// true — JSON.stringify is deterministic here
console.log('round-trip equal:', reEncoded === wire);
