/**
 * subschemaAt — anti-pattern: invalid JSON Pointer
 *
 * `subschemaAt` requires an RFC 6901 JSON Pointer beginning with `/`.
 * A bare property name like `'isbn'` is invalid and surfaces a
 * `GraphError` with code `POINTER_INVALID`. The valid form is
 * `/properties/isbn`.
 */

import {
  BookSchema, bookstoreEntities
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
console.assert(caught?.code === 'POINTER_INVALID');

const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');

console.assert(isbnSchema !== undefined);
