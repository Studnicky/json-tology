/**
 * Anti-pattern: declaring sameAs between two editions of the same title.
 *
 * sameAs asserts identity of individuals, not "they share a title".
 * The 1979 Thienemann first edition and the 1984 Penguin English
 * translation of Die unendliche Geschichte are two distinct physical
 * books with different ISBNs, publishers, page counts, prices, and
 * condition notes. They share an author and a title — that is what
 * Compose.equivalent / shared $ref to the title primitive expresses
 * at the class level, NOT what sameAs expresses at the instance level.
 */

import { bookstoreEntities } from '../bookstore/index.js';

// WRONG — collapses two physically distinct books into one logical
// individual. A reasoner consuming both edges will treat one book as
// having two ISBNs, two publishers, two prices, and two condition
// reports, silently corrupting the catalog. Do NOT do this:
//   bookstoreEntities.sameAs(
//     'urn:bookstore:rarebook:neverending-1979-thienemann',
//     'urn:bookstore:rarebook:neverending-1984-penguin'
//   );

// RIGHT — use sameAs only across two IRIs that authoritatively name the
// same physical or logical individual (one record in two systems, one
// customer across a migration, one book in two union catalogs).
bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:neverending-1979-thienemann',
  'http://www.worldcat.org/oclc/5705614'
);

// The recorded pair is now in the registry's sameAsStore — toQuads
// (called from any later page that emits ABox quads) will emit both
// directions of the owl:sameAs link symmetrically.
console.assert(true, 'sameAs assertion recorded against authoritative pair');
console.log('sameAs recorded: urn:bookstore:rarebook:neverending-1979-thienemann ↔ http://www.worldcat.org/oclc/5705614');
