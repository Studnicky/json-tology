/**
 * GraphError — pointer resolution failure.
 *
 * `subschemaAt` walks a JSON Pointer into the canonical OrderSchema.
 * A pointer that does not address an existing fragment surfaces a
 * GraphError with code `POINTER_NOT_FOUND` and the offending pointer
 * attached.
 */

import { GraphError } from '../../../src/index.js';
import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

try {
  bookstoreEntities.subschemaAt(OrderSchema.$id, '/properties/nope');
} catch (error) {
  if (error instanceof GraphError) {
    console.assert(error.code === 'POINTER_NOT_FOUND');
    console.assert(error.pointer === '/properties/nope');

    console.log('error.code:', error.code);
    console.log('error.pointer:', error.pointer);
    console.log('error.message:', error.message);
  }
}
