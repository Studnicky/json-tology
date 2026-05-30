/**
 * Bookstore domain: import directly from an entity file
 *
 * When a guide page needs only one entity's schema — without the full
 * registry — it can import directly from the entity's source file.
 * This avoids pulling in all 31 schemas and their side effects.
 *
 * Use the direct-entity import when: the entity schema is self-contained
 * (no cross-schema $ref needed at runtime), or when running a compile-time
 * type assertion that doesn't need `bookstoreEntities`.
 */

import { JsonTology } from '../../../src/index.js';
import { IsbnSchema } from '../bookstore/entities/Isbn.js';

// Direct entity import — schema constant available without registry.
const isbnId: string = IsbnSchema.$id;

console.assert(isbnId === 'urn:bookstore:Isbn');

// Validate with one-shot static form — no shared registry needed.
const errs = JsonTology.validate(IsbnSchema, '9783522128001');

// IsbnSchema validates a raw string (type: 'string'), not an object.
// An empty collection confirms the ISBN-13 format passes.
console.assert(errs.length === 0);

console.log('direct entity $id:', isbnId);
console.log('valid ISBN-13 errors:', errs.length);
console.log('rejected non-ISBN errors:', JsonTology.validate(IsbnSchema, 'not-an-isbn').length);
