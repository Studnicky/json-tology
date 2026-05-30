/**
 * Bookstore taxonomy — EBookSchema as a Compose.subClassOf(Book)
 *
 * The canonical `EBookSchema` is defined in
 * `examples/docs/bookstore/entities/EBook.ts`. Reading the entity file
 * shows the full declaration; this runnable demo imports it and
 * exercises both the structural validation and the OWL TBox
 * subclass edge it emits.
 */

import {
  bookstoreEntities, EBookSchema
} from '../bookstore/index.js';

const ebook = {
  'authors': ['Michael Ende'],
  'downloadUrl': 'https://bookstore.example/dl/9783522128001.epub',
  'epubVersion': '3.2',
  'fileFormat': 'epub' as const,
  'fileSizeBytes': 5_872_000,
  'inStock': true,
  'isbn': '9783522128001',
  'pageCount': 428,
  'price': {
    'amount': 12.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint' as const,
  'publishedOn': '1979-09-01',
  'stockLevel': 0,
  'title': 'Die unendliche Geschichte'
};

// Structural validation: passes against EBookSchema.
const ebookErrs = bookstoreEntities.validate(EBookSchema.$id, ebook);

console.assert(ebookErrs.length === 0);
// 0 — epub ebook passes EBook constraints
console.log('validation errors:', ebookErrs.length);

// The TBox emits `urn:bookstore:EBook rdfs:subClassOf urn:bookstore:Book`.
// Materialize the OWL JSON-LD and verify the subClassOf assertion lives
// alongside the structural validation in a single source of truth.
const owl = bookstoreEntities.ontology().jsonLdObject();
const graphNodes = owl['@graph'] as ReadonlyArray<Record<string, unknown>>;
const ebookNode = graphNodes.find((node) => {
  return node['@id'] === EBookSchema.$id;
});

console.assert(ebookNode !== undefined);
// The rdfs:subClassOf edge is the OWL projection of Compose.subClassOf.
const RDFS_SUB_CLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const subClassOf = ebookNode?.[RDFS_SUB_CLASS_OF] as ReadonlyArray<{ readonly '@id': string }>;

console.assert(Array.isArray(subClassOf));
console.assert(subClassOf.some((ref) => {
  return ref['@id'] === 'urn:bookstore:Book';
}));
// urn:bookstore:EBook
console.log('EBook $id:', EBookSchema.$id);
// true
console.log('subClassOf Book:', subClassOf.some((ref) => {
  return ref['@id'] === 'urn:bookstore:Book';
}));
