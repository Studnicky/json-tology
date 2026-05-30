/**
 * Link a legacy CRM identifier to a stable customer IRI.
 *
 * The bookstore migrated from a legacy CRM in 2024. Bastian carries the
 * current bookstore IRI alongside the legacy CRM ID (`cust-00042`).
 * Declaring sameAs lets a reasoner merge facts from both authoritative
 * sources into one logical individual.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

bookstoreEntities.sameAs(
  'urn:bookstore:customer:bastian-bux',
  'urn:legacy-crm:cust-00042'
);

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

// quads include both directions:
//   <urn:bookstore:customer:bastian-bux> owl:sameAs <urn:legacy-crm:cust-00042>
//   <urn:legacy-crm:cust-00042>          owl:sameAs <urn:bookstore:customer:bastian-bux>
const sameAsQuads = quads.filter((quad) => {
  return quad.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs';
});

console.assert(sameAsQuads.length >= 2, 'symmetric owl:sameAs emitted');
console.log('owl:sameAs quads emitted:', sameAsQuads.length);
