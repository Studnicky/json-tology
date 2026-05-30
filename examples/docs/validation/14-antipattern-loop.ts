import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const candidateIsbns = [
  '978014044913',
  '978043942457'
];

// Anti-pattern: re-resolves and re-registers the sub-schema on every iteration
// Don't do this
for (const rawIsbn of candidateIsbns) {
  const sub = jt.subschemaAt(BookSchema.$id, '/properties/isbn');

  jt.validate(sub, rawIsbn);
}

// Correct approach: resolve once, reuse across calls
const isbnSchema = jt.subschemaAt(BookSchema.$id, '/properties/isbn');

for (const rawIsbn of candidateIsbns) {
  const result = jt.validate(isbnSchema, rawIsbn);

  if (typeof result === 'object') {
    console.assert(true, 'Each validation should complete');
  }
  console.log(`isbn ${rawIsbn}: ok = ${result.ok}, errors = ${result.length}`);
}
