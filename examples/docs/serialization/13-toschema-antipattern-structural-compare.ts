/**
 * toSchema — Anti-pattern 2: Using reconstructed schema for structural comparison
 * Demonstrates: normalization may reorder keys; don't compare reconstructed vs original
 *
 * Deep-equal or JSON.stringify comparison between reconstructed and original
 * may return false even when schemas are semantically equivalent. Use the
 * original schema for structural comparisons.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Anti-pattern: fragile comparison — normalization may reorder keys or inline $defs
// Don't do this
const reconstructed = bookstoreEntities.toSchema(OrderSchema.$id);

// JSON.stringify comparison may be false even for semantically equivalent schemas
const reconstructedStr = JSON.stringify(reconstructed);
const originalStr = JSON.stringify(OrderSchema);

// This comparison is not reliable — do not gate logic on it
void reconstructedStr;
void originalStr;

// Correct approach: use toSchema for debugging and display only
// Use the original schema or validate data for structural correctness
const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

console.assert(order.id === aboxFixtures.order.id);
