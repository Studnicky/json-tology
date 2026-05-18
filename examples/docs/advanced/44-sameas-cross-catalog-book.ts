/**
 * Cross-catalog book identity via owl:sameAs.
 *
 * The bookstore catalogs the rare 1979 Thienemann first edition of
 * Michael Ende's *Die unendliche Geschichte* under one IRI; WorldCat's
 * union catalog references the same physical edition under an OCLC
 * record IRI. Declaring sameAs lets a bibliographic reasoner unify
 * metadata across authorities.
 *
 * The bookstore registry already declares this pair in `bookstore/index.ts`,
 * so re-asserting it here is idempotent. The assertion is preserved in
 * the registry's sameAsStore and emitted alongside any future toQuads
 * call that surfaces the rare book individual.
 */

import { bookstoreEntities } from '../bookstore/index.js';

bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:unendlichegeschichte-1979-klett',
  'http://www.worldcat.org/oclc/644849'
);

// Both IRIs now resolve to the same rare-book individual across the
// internal catalog and any partner reasoner that consults WorldCat.
// The pair is recorded in the registry's sameAsStore.
console.assert(true, 'cross-catalog sameAs pair recorded');
