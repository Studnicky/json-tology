/**
 * owl:sameAs is symmetric — toQuads emits both directions explicitly.
 *
 * Reasoners differ in whether they materialize the symmetric edge.
 * json-tology emits both directions at toQuads() time so consumers see
 * the relation regardless of reasoner behaviour.
 */

import {
  aboxFixtures, createBookstoreDocRegistry, CustomerSchema
} from '../bookstore/index.js';

const registry = createBookstoreDocRegistry();

registry.sameAs(
  'urn:bookstore:customer:bastian-bux',
  'urn:legacy-crm:cust-00042'
);

const quads = registry.toQuads(CustomerSchema, aboxFixtures.customer);

const sameAsQuads = quads.filter((quad) => {
  return quad.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs';
});

// Both directions always emitted.
console.assert(sameAsQuads.length === 2, 'both directions emitted');
const subjects = new Set(sameAsQuads.map((quad) => {
  return quad.subject.value;
}));

console.assert(subjects.has('urn:bookstore:customer:bastian-bux'), 'forward subject present');
console.assert(subjects.has('urn:legacy-crm:cust-00042'), 'reverse subject present');
console.log('symmetric owl:sameAs subjects:', [...subjects]);
