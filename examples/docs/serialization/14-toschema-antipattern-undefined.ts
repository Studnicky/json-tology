/**
 * toSchema — Anti-pattern 3: Calling toSchema for unregistered schema without undefined check
 * Demonstrates: always guard against undefined before accessing the result
 *
 * Accessing .properties on an undefined return value throws a TypeError.
 * The correct approach checks for undefined first.
 */

import {
  bookstoreEntities
} from '../bookstore/index.js';

// Correct approach: check for undefined before accessing the result
const safeSchema = (bookstoreEntities.toSchema as (id: string) => Record<string, unknown> | undefined)('https://bookstore.example/Nonexistent');

// Anti-pattern: skipping the undefined check before accessing .properties
// const props = Object.keys(safeSchema.properties ?? {});
// ^ TypeError if safeSchema is undefined

if (safeSchema === undefined) {
  // Schema not registered — handle gracefully
  console.assert(true, 'Correctly handled undefined for unregistered schema');
} else {
  // safeSchema is Record<string, unknown> here — no cast needed
  const propsObj = safeSchema.properties as Record<string, unknown>;
  const props = Object.keys(propsObj);

  void props;
}

console.assert(safeSchema === undefined);
