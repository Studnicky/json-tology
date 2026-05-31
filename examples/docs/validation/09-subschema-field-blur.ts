import {
  BibliographicRecordSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Resolve the isbn sub-schema once — isbn lives on BibliographicRecordSchema, not Book
const isbnSchema = jt.subschemaAt(BibliographicRecordSchema.$id, '/properties/isbn');

// isbn must match ^\d{13}$ — 12 digits fails, requires 13
const errors = jt.validate(isbnSchema, '978014044913');

console.assert(!errors.ok, 'Invalid ISBN should fail validation');
console.assert(
  errors.items.some((err) => {
    return err.message.includes('pattern');
  }),
  'Should have pattern error'
);

console.log('isbn sub-schema id:', isbnSchema.$id);
console.log('invalid isbn: ok =', errors.ok, ', error =', errors.items[0]?.message);
