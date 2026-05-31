/**
 * subschemaAt — anti-pattern: invalid JSON Pointer
 *
 * `subschemaAt` requires an RFC 6901 JSON Pointer beginning with `/`.
 * A bare property name like `'isbn'` is invalid and surfaces a
 * `GraphError` with code `POINTER_INVALID`. The valid form is
 * `/properties/isbn`.
 */

import {
  BibliographicRecordSchema, BookSchema, bookstoreEntities
} from '../bookstore/index.js';
import { GraphError } from '../../../src/index.js';

let caught: GraphError | undefined;

try {
  bookstoreEntities.subschemaAt(BookSchema.$id, 'isbn');
} catch (error) {
  if (error instanceof GraphError) {
    caught = error;
  }
}

console.assert(caught !== undefined);
if (caught) {
  console.assert(caught.code === 'POINTER_INVALID');
}

console.log('bare pointer error code:', caught?.code);

// isbn lives on BibliographicRecordSchema; the valid pointer targets it there
const isbnSchema = bookstoreEntities.subschemaAt(BibliographicRecordSchema.$id, '/properties/isbn');

console.assert(typeof isbnSchema === 'object');
console.log('valid pointer resolves $id:', isbnSchema.$id);
