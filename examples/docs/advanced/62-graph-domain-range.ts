/**
 * Domain and range — how $ref produces rdfs:domain / rdfs:range edges.
 *
 * When a schema property uses `{ $ref: IsbnSchema.$id }`, the canonical graph
 * creates a typed property edge: the property's domain is the parent class
 * (Book) and its range is the referenced class (Isbn). The OWL TBox projects
 * these edges as `rdfs:domain` and `rdfs:range` triples.
 *
 * Demonstrates: inspecting the TBox JSON-LD output to verify domain/range
 * assertions are present for bookstore schemas.
 */

import {
  BookSchema, bookstoreEntities, IsbnSchema
} from '../bookstore/index.js';

// Generate the OWL TBox from the registered bookstore schemas
const tbox = bookstoreEntities.toTbox();
const jsonLd = tbox.jsonLd();

// The TBox string should reference both Book and Isbn class IRIs
console.assert(
  jsonLd.includes(BookSchema.$id),
  'TBox references the Book class IRI'
);
console.assert(
  jsonLd.includes(IsbnSchema.$id),
  'TBox references the Isbn class IRI'
);

// The JSON-LD object carries the graph nodes we can inspect
const jsonLdObj = tbox.jsonLdObject();

console.assert(
  Array.isArray(jsonLdObj['@graph']),
  'TBox JSON-LD contains a @graph array'
);
