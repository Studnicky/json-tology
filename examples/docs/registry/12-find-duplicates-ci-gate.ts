/**
 * findDuplicates — Example 2: CI gate — exit non-zero when duplicates found
 * Demonstrates: using findDuplicates() as a quality gate in a build script
 *
 * In a real CI pipeline a non-empty result would log each duplicate and
 * call `process.exit(1)`. This file mirrors that shape without actually
 * exiting so the docs smoke suite can import it.
 */

import { bookstoreEntities } from '../bookstore/index.js';

const dups = bookstoreEntities.registry.findDuplicates();

const lines: string[] = [];

for (const dup of dups) {
  lines.push(`  ${dup.schemaId}#${dup.pointer} duplicates ${dup.equivalentTo}`);
}

// In a CI script: `if (dups.length > 0) process.exit(1)`. The example
// captures the boolean instead so importing the file is safe.
const shouldFail = dups.length > 0;

console.assert(typeof shouldFail === 'boolean', 'CI gate result is a boolean');
console.assert(Array.isArray(lines), 'lines is the array a CI script would print');

console.log('duplicates found:', dups.length);
console.log('CI gate would fail:', shouldFail);
if (lines.length > 0) {
  for (const line of lines) {
    console.log(line);
  }
} else {
  console.log('no duplicates - registry is clean');
}
