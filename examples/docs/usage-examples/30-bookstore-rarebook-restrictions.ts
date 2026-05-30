/**
 * Bookstore taxonomy — RareBookSchema with someValuesFrom + maxCardinality
 *
 * The canonical `RareBookSchema` is defined in
 * `examples/docs/bookstore/entities/RareBook.ts`. Two OWL restrictions
 * are layered onto the parent `PrintBook` axis:
 *
 *   - `someValuesFrom(authors, AuthorName)` — at least one element of
 *     `authors` is an AuthorName instance.
 *   - `maxCardinality(authors, 1)` — at most one author.
 *
 * The 1979 Thienemann first edition of Die unendliche Geschichte (sole
 * author: Michael Ende) satisfies both restrictions and validates.
 */

import {
  aboxFixtures, bookstoreEntities, RareBookSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(RareBookSchema.$id, aboxFixtures.rareBook);

console.assert(errs.length === 0);
// 0 — sole-author first edition passes restrictions
console.log('validation errors:', errs.length);

// The TBox carries two anonymous owl:Restriction blank nodes referenced
// via rdfs:subClassOf, one per restriction.
const owl = bookstoreEntities.ontology().jsonLdObject();
const graphNodes = owl['@graph'] as ReadonlyArray<Record<string, unknown>>;
const rareNode = graphNodes.find((node) => {
  return node['@id'] === RareBookSchema.$id;
});

console.assert(rareNode !== undefined);
// urn:bookstore:RareBook
console.log('RareBook $id:', RareBookSchema.$id);
// true — restrictions emitted
console.log('TBox node found:', rareNode !== undefined);
