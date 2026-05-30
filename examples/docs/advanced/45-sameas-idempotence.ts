/**
 * sameAs is idempotent — duplicate and reverse pairs are no-ops.
 *
 * Recording the same pair twice, or in reverse order, is a no-op.
 * Self-pairs (a sameAs a) are silently dropped.
 */

import {
  aboxFixtures, createBookstoreDocRegistry, CustomerSchema
} from '../bookstore/index.js';

const registry = createBookstoreDocRegistry();

registry.sameAs(
  'urn:bookstore:customer:bastian-bux',
  'urn:legacy-crm:cust-00042'
);
// No-op — pair already recorded.
registry.sameAs(
  'urn:legacy-crm:cust-00042',
  'urn:bookstore:customer:bastian-bux'
);
// No-op — self-pair.
registry.sameAs(
  'urn:bookstore:customer:bastian-bux',
  'urn:bookstore:customer:bastian-bux'
);

const quads = registry.toQuads(CustomerSchema, aboxFixtures.customer);

// Only the single recorded pair contributes quads (forward + reverse = 2).
const sameAsQuads = quads.filter((quad) => {
  return quad.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs'
   && (quad.subject.value === 'urn:bookstore:customer:bastian-bux' || quad.subject.value === 'urn:legacy-crm:cust-00042');
});

console.assert(sameAsQuads.length === 2, 'idempotent — only forward + reverse emitted');
console.log('sameAs quad count (idempotent):', sameAsQuads.length, '(duplicate and reverse pair dropped)');
