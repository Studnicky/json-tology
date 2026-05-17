import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const candidateIsbns = [
  '978014044913',
  '978043942457'
];

// Anti-pattern: re-resolves and re-registers the sub-schema on every iteration
// Don't do this
for (const rawIsbn of candidateIsbns) {
  const sub = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');

  bookstoreEntities.validate(sub, rawIsbn);
}

// Correct approach: resolve once, reuse across calls
const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');

for (const rawIsbn of candidateIsbns) {
  const result = bookstoreEntities.validate(isbnSchema, rawIsbn);

  console.assert(result !== undefined, 'Each validation should complete');
}
