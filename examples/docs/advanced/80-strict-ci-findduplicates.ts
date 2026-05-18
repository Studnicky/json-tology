/**
 * CI script pattern — findDuplicates as a quality gate.
 *
 * Run `registry.findDuplicates()` after constructing the registry to detect
 * inline shapes that should be extracted to named schemas. In a CI script
 * the recipe is: log each duplicate, then `process.exit(1)` if any were
 * found. This file shows the same shape without exiting so the docs
 * smoke suite can import it.
 *
 * Demonstrates: `findDuplicates()` on the bookstore registry; the
 * shouldFail flag mirrors the CI gate without actually terminating the
 * process.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const duplicates = bookstoreEntities.registry.findDuplicates();

const lines: string[] = [];

for (const dup of duplicates) {
  lines.push(`Duplicate: ${dup.schemaId}#${dup.pointer} ≡ ${dup.equivalentTo}`);
}

// In a CI script this branch would call `process.exit(1)`. Inside docs
// examples we record the would-be exit instead so the suite stays
// importable.
const shouldFail = duplicates.length > 0;

console.assert(
  typeof shouldFail === 'boolean',
  'shouldFail is the boolean CI gate result'
);
console.assert(
  Array.isArray(lines),
  'lines is the array a CI script would print before exiting'
);
