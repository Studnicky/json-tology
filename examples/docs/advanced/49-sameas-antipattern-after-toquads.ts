/**
 * Anti-pattern: calling sameAs after toQuads instead of before.
 *
 * sameAs assertions only contribute quads to the toQuads() call that
 * follows them. A sameAs recorded after toQuads is too late — the
 * earlier quad set has already been emitted without the identity link.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// WRONG — record the assertion AFTER projecting.
const tooEarly = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

bookstoreEntities.sameAs(
  'urn:bookstore:customer:bastian-bux',
  'urn:legacy-crm:cust-00042'
);

const tooEarlySameAs = tooEarly.filter((quad) => {
  return quad.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs';
});

console.assert(tooEarlySameAs.length === 0, 'first projection missed the sameAs link');

// RIGHT — record sameAs assertions BEFORE calling toQuads.
const onTime = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

const onTimeSameAs = onTime.filter((quad) => {
  return quad.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs';
});

console.assert(onTimeSameAs.length >= 2, 'second projection includes the sameAs link');
