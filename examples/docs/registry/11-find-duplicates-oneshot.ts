/**
 * findDuplicates — Example 1: One-shot audit of the bookstore registry
 * Demonstrates: findDuplicates() returns an array, each entry has schemaId/pointer/equivalentTo
 *
 * The canonical bookstore registry is structured to avoid inline shapes that
 * duplicate named schemas — all primitives are extracted and $ref'd. Running
 * findDuplicates() confirms the registry is clean. The result type is shown
 * via console.assert on the array.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const dups = bookstoreEntities.registry.findDuplicates();

// The bookstore registry uses named $ref schemas throughout — no inline duplicates.
for (const dup of dups) {
  console.log(`${dup.schemaId}#${dup.pointer} duplicates ${dup.equivalentTo}`);
}

console.assert(Array.isArray(dups));
// A well-structured registry with all shapes extracted should have zero duplicates.
console.assert(dups.length === 0);

console.log('duplicate count:', dups.length);
console.log('registry is clean:', dups.length === 0);
