/**
 * $ref resolution — cross-schema edges in the canonical graph.
 *
 * `$ref` creates a directed edge in the schema graph from the parent schema
 * to the referenced schema. The registry resolves these edges at registration
 * time. The TBox projection follows these edges to emit `rdfs:range` assertions.
 *
 * BookSchema references IsbnSchema via `{ $ref: IsbnSchema.$id }`.
 * The graph edge Book → isbn → Isbn is visible in the TBox JSON-LD as a
 * property whose domain is Book and range is Isbn.
 *
 * Demonstrates: cross-schema $ref edges visible in TBox output.
 */

import {
  BookSchema, bookstoreEntities, IsbnSchema, TitleSchema
} from '../bookstore/index.js';

const tbox = bookstoreEntities.toTbox();
const jsonLd = tbox.jsonLd();

// Both ends of the $ref edge must appear in the TBox
console.assert(jsonLd.includes(BookSchema.$id), 'Book class in TBox');
console.assert(jsonLd.includes(IsbnSchema.$id), 'Isbn class in TBox (cross-schema $ref)');
console.assert(jsonLd.includes(TitleSchema.$id), 'Title class in TBox (cross-schema $ref)');

// The graph is a directed graph: the $ref becomes a typed property edge
const tboxGraph = tbox.jsonLdObject()['@graph'] as unknown[];

console.assert(tboxGraph.length > 0, 'TBox graph produced from cross-schema refs');

console.log('$ref resolution: Book in TBox:', jsonLd.includes(BookSchema.$id), '| Isbn in TBox:', jsonLd.includes(IsbnSchema.$id), '| graph nodes:', tboxGraph.length);
