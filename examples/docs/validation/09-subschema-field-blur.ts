import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// Resolve the isbn sub-schema once
const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');

// isbn must match ^\d{13}$ — 12 digits fails, requires 13
const errors = bookstoreEntities.validate(isbnSchema, '978014044913');

console.assert(!errors.ok, 'Invalid ISBN should fail validation');
console.assert(
  errors.items.some((err) => {
    return err.message.includes('pattern');
  }),
  'Should have pattern error'
);
