/**
 * `fromQuads` subject-type dispatch — lifting EBook and PrintBook individuals.
 *
 * When a quad set contains individuals of different types, `fromQuads` uses
 * the `rdf:type` triple on each subject to dispatch to the correct schema.
 * Calling `fromQuads` with `EBookSchema.$id` lifts only EBook subjects;
 * calling it with `PrintBookSchema.$id` lifts only PrintBook subjects.
 *
 * This example builds a combined quad set from both an EBook and a PrintBook
 * fixture, then lifts each back through its own schema independently.
 */

import {
  aboxFixtures,
  bookstoreEntities,
  EBookSchema,
  PrintBookSchema
} from '../bookstore/index.js';

// ── Project each individual to quads ──────────────────────────────────────
const ebook = bookstoreEntities.instantiate(EBookSchema, aboxFixtures.ebook);
const printBook = bookstoreEntities.instantiate(PrintBookSchema, aboxFixtures.printBook);

const ebookQuads = bookstoreEntities.toQuads(EBookSchema, ebook);
const printBookQuads = bookstoreEntities.toQuads(PrintBookSchema, printBook);

// Combine into one flat quad array — as if both arrived from a SPARQL CONSTRUCT.
const combinedQuads = [
  ...ebookQuads,
  ...printBookQuads
];

console.assert(combinedQuads.length > 0, 'combined quad set is non-empty');

// ── Lift by schema — subject-type dispatch ────────────────────────────────
// fromQuads filters by rdf:type and instantiates matching subjects only.
const liftedEbooks = bookstoreEntities.fromQuads(EBookSchema.$id, combinedQuads);
const liftedPrintBooks = bookstoreEntities.fromQuads(PrintBookSchema.$id, combinedQuads);

console.assert(liftedEbooks.length === 1, 'exactly one EBook lifted from combined quads');
console.assert(liftedPrintBooks.length === 1, 'exactly one PrintBook lifted from combined quads');

// ── Verify field values round-tripped correctly ───────────────────────────
if (liftedEbooks.length === 0 || liftedPrintBooks.length === 0) {
  throw new Error('expected lifted instances not found');
}

const liftedEbook = liftedEbooks[0];
const liftedPrint = liftedPrintBooks[0];

if (liftedEbook === undefined || liftedPrint === undefined) {
  throw new Error('expected lifted instances not found');
}

console.assert(
  liftedEbook.isbn === aboxFixtures.ebook.isbn,
  'EBook isbn round-tripped'
);
console.assert(
  liftedEbook.fileFormat === aboxFixtures.ebook.fileFormat,
  'EBook fileFormat round-tripped'
);

// downloadUrl was emitted as a NamedNode (x-jt-iriRef: true); fromQuads
// lifts the IRI back as a plain string value — the JS type is string in both directions.
console.assert(
  liftedEbook.downloadUrl === aboxFixtures.ebook.downloadUrl,
  'EBook downloadUrl round-tripped from NamedNode'
);

console.assert(
  liftedPrint.isbn === aboxFixtures.printBook.isbn,
  'PrintBook isbn round-tripped'
);
console.assert(
  liftedPrint.binding === aboxFixtures.printBook.binding,
  'PrintBook binding round-tripped'
);

console.log('Combined quad set size:', combinedQuads.length);
console.log('\nLifted EBook:');
console.log('  isbn:', liftedEbook.isbn);
console.log('  fileFormat:', liftedEbook.fileFormat);
console.log('  downloadUrl:', liftedEbook.downloadUrl);

console.log('\nLifted PrintBook:');
console.log('  isbn:', liftedPrint.isbn);
console.log('  binding:', liftedPrint.binding);
