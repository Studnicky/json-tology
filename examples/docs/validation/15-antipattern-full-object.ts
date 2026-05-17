import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// Anti-pattern: sub-schema validation ignores sibling constraints
// Don't do this - sub-schema validation ignores sibling constraints
const isbnSub = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');
const rawBook = { 'isbn': '978014044913' };
const validateSub = bookstoreEntities.validate(isbnSub, rawBook);

console.assert(!validateSub.ok || true, 'Sub-schema may not catch missing required fields');

// Correct approach: validate the full object against its registered schema
const validateFull = bookstoreEntities.validate(BookSchema.$id, rawBook);

console.assert(!validateFull.ok, 'Full schema validation should catch missing fields');
