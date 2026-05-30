/**
 * CI script pattern — findDuplicates as a quality gate.
 *
 * Run `registry.findDuplicates()` after constructing the registry to detect
 * inline shapes that should be extracted to named schemas. In a CI script
 * the recipe is: log each duplicate, then exit non-zero if any were found.
 * This file shows the browser-safe core: no process.* calls.
 *
 * Demonstrates: `findDuplicates()` on the bookstore registry; the
 * shouldFail flag mirrors the CI gate result. A real CI wrapper would call
 * `process.exit(1)` on `shouldFail === true` — that Node-specific call lives
 * outside this example to keep the core browser-safe.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const duplicates = bookstoreEntities.registry.findDuplicates();

const lines: string[] = [];

for (const dup of duplicates) {
  lines.push(`Duplicate: ${dup.schemaId}#${dup.pointer} ≡ ${dup.equivalentTo}`);
}

// shouldFail is the boolean CI gate result: true means a CI script should
// exit non-zero (e.g. `if (shouldFail) process.exit(1)` in a Node wrapper).
const shouldFail = duplicates.length > 0;

console.log(`findDuplicates: ${duplicates.length} duplicate(s) found`);
console.log(`Registry clean: ${!shouldFail}`);

if (lines.length > 0) {
  for (const line of lines) {
    console.log(line);
  }
}

console.assert(
  typeof shouldFail === 'boolean',
  'shouldFail is the boolean CI gate result'
);
console.assert(
  Array.isArray(lines),
  'lines is the array a CI script would print before exiting'
);
