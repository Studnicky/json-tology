/**
 * Sub-schema patterns — TBox emits a typed property edge per $ref
 *
 * Every `$ref` in the TypeScript-side schema becomes a typed property
 * edge in the canonical graph. The OWL projection emits
 * `rdfs:domain` and `rdfs:range` for the parent class and the
 * referenced class respectively.
 *
 * Demonstrated against the canonical `CustomerSchema`, which $refs
 * `EmailSchema` for the `email` slot.
 */

import {
  bookstoreEntities, EmailSchema
} from '../bookstore/index.js';

const owl = bookstoreEntities.ontology().jsonLdObject();
const graphNodes = owl['@graph'] as ReadonlyArray<Record<string, unknown>>;

// EmailSchema appears as its own class node in the OWL projection.
const emailNode = graphNodes.find((node) => {
  return node['@id'] === EmailSchema.$id;
});

console.assert(emailNode !== undefined);

// Some property whose range is EmailSchema (e.g. https://bookstore.example/email)
// resolves via the typed property edge.
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';

const emailRangeProperty = graphNodes.find((node) => {
  const range = node[RDFS_RANGE];

  if (range === undefined) {
    return false;
  }
  const refs = Array.isArray(range) ? range : [range];

  return refs.some((ref) => {
    return (ref as { readonly '@id'?: string })['@id'] === EmailSchema.$id;
  });
});

console.assert(emailRangeProperty !== undefined);
// https://bookstore.example/Email
console.log('Email $id:', EmailSchema.$id);
// e.g. https://bookstore.example/email
console.log('property with email range:', emailRangeProperty?.['@id']);
