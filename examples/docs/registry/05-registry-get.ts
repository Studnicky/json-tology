import { Compose } from '../../../src/index.js';
import {
  BibliographicRecordSchema,
  BookSchema,
  bookstoreEntities
} from '../bookstore/index.js';

// BookSchema is a Compose.subClassOf composition: the registry stores the allOf
// form, so retrieving it gives back { $id, allOf } rather than a flat properties
// map. Flat schemas like BibliographicRecordSchema round-trip cleanly.
const bibliographic = bookstoreEntities.registry.get(BibliographicRecordSchema.$id);
const book = bookstoreEntities.registry.get(BookSchema.$id);

console.assert(bibliographic !== undefined, 'BibliographicRecordSchema should be retrievable');
console.assert(book !== undefined, 'BookSchema should be retrievable');
console.assert(
  (bibliographic?.properties as Record<string, unknown> | undefined)?.isbn !== undefined,
  'BibliographicRecordSchema.properties.isbn should exist'
);

if (bibliographic) {
  // Compose.pick on a flat schema — picks from its own properties.
  const BibliographicSummary = Compose.pick(
    bibliographic as typeof BibliographicRecordSchema,
    [
      'isbn',
      'title'
    ] as const,
    'https://bookstore.example/BibliographicSummary'
  );

  console.assert(typeof BibliographicSummary.$id === 'string', 'Composed schema should have $id');
  console.log('retrieved bibliographic $id:', bibliographic.$id);
  console.log('BibliographicSummary $id:', BibliographicSummary.$id);
  console.log('BibliographicSummary properties:', Object.keys(BibliographicSummary.properties));
}

// Composed schemas are stored as-is: Book's registry entry has allOf, not properties.
console.log('retrieved Book $id:', book?.$id);
console.log('Book registry shape keys:', book ? Object.keys(book) : '—');
