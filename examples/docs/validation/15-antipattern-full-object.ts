import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Anti-pattern: sub-schema validation ignores sibling constraints
// Don't do this - sub-schema validation ignores sibling constraints
const isbnSub = jt.subschemaAt(BookSchema.$id, '/properties/isbn');
const rawBook = { 'isbn': '978014044913' };
const validateSub = jt.validate(isbnSub, rawBook);

console.assert(!validateSub.ok || true, 'Sub-schema may not catch missing required fields');

// Correct approach: validate the full object against its registered schema
const validateFull = jt.validate(BookSchema.$id, rawBook);

console.assert(!validateFull.ok, 'Full schema validation should catch missing fields');
