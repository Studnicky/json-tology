import { Compose } from '../../../src/index.js';
import {
  BibliographicRecordSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Compose.pick reads the schema's own `properties` key, so picking from flat
// schemas (like BibliographicRecordSchema) works directly. BookSchema is a
// Compose.subClassOf composition (allOf): pick bibliographic fields from
// BibliographicRecordSchema rather than from BookSchema.
const BookSummarySchema = Compose.pick(
  BibliographicRecordSchema,
  [
    'isbn',
    'title',
    'authors'
  ] as const,
  'https://bookstore.example/BookSummary'
);

jt.set(BookSummarySchema);

console.assert(
  jt.registry.has('https://bookstore.example/BookSummary'),
  'BookSummarySchema should be registered'
);

console.log('BookSummary $id:', BookSummarySchema.$id);
console.log('registered in registry:', jt.registry.has(BookSummarySchema.$id));
console.log('picked properties:', Object.keys(BookSummarySchema.properties));
