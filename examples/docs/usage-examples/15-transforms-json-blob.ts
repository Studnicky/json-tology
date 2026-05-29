/**
 * Transforms recipes — JSON string ↔ parsed value
 *
 * Validation runs against the wire `string`. If callers want the
 * decoded value to be validated too, register the inner schema
 * separately and use a `$ref` rather than a transform.
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

const JsonBlobSchema = {
  '$id': 'https://bookstore.example/JsonBlob',
  'type': 'string'
} as const;

jt.set(JsonBlobSchema);

const JsonBlobTransform = Transform.create<typeof JsonBlobSchema, unknown>(JsonBlobSchema, {
  'decode': (wire) => {
    return JSON.parse(wire) as unknown;
  },
  'encode': (value) => {
    return JSON.stringify(value);
  }
});

const wire = JSON.stringify(aboxFixtures.rareBook);
const decoded = jt.instantiate(JsonBlobTransform, wire);

console.assert(typeof decoded === 'object');
console.assert((decoded as { 'isbn': string }).isbn === aboxFixtures.rareBook.isbn);

const reEncoded = jt.encode(JsonBlobTransform, decoded);

console.assert(reEncoded === wire);
