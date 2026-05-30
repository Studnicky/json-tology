/**
 * Bookstore taxonomy — PrintBookSchema with subClassOf(Book) + disjointWith(EBook)
 *
 * The canonical `PrintBookSchema` is defined in
 * `examples/docs/bookstore/entities/PrintBook.ts`. The disjointWith
 * declaration asserts that no single value can be both a `PrintBook`
 * and an `EBook` at the same time — physical and digital formats are
 * mutually exclusive.
 *
 * `validate` enforces the constraint at runtime: after a value passes
 * `PrintBook`'s structural check, the registry runs `EBookSchema`
 * against it; if both succeed it surfaces a disjointWith violation.
 */

import {
  aboxFixtures, bookstoreEntities, PrintBookSchema
} from '../bookstore/index.js';

// rareBook is a print book — passes PrintBookSchema cleanly.
const errs = bookstoreEntities.validate(PrintBookSchema.$id, aboxFixtures.rareBook);

console.assert(errs.length === 0);
// 0 — rare book passes PrintBook constraints
console.log('validation errors:', errs.length);

// The TBox emits `urn:bookstore:PrintBook owl:disjointWith
// urn:bookstore:EBook`. Verify via the OWL JSON-LD projection.
const owl = bookstoreEntities.ontology().jsonLdObject();
const graphNodes = owl['@graph'] as ReadonlyArray<Record<string, unknown>>;
const printNode = graphNodes.find((node) => {
  return node['@id'] === PrintBookSchema.$id;
});

const OWL_DISJOINT_WITH = 'http://www.w3.org/2002/07/owl#disjointWith';
const disjointWith = printNode?.[OWL_DISJOINT_WITH] as undefined | { readonly '@id': string };

if (disjointWith === undefined) {
  throw new TypeError('PrintBook node is missing owl:disjointWith');
}

console.assert(disjointWith['@id'] === 'urn:bookstore:EBook');
// 'urn:bookstore:EBook' — physical XOR digital
console.log('disjointWith:', disjointWith['@id']);
