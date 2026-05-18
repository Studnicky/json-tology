/**
 * Compose.pick — Anti-pattern 1: Forgetting `as const` on the keys array
 *
 * Without `as const`, the keys array widens to `string[]` and
 * TypeScript loses the literal types — pick can no longer narrow the
 * inferred property set. Always pass keys as a `const` tuple.
 */

import { Compose } from '../../../src/index.js';
import { BookSchema } from '../bookstore/index.js';

// ✓ Do this — `as const` preserves literal types so pick narrows correctly.
const BookSummarySchema = Compose.pick(
  BookSchema,
  [
    'isbn',
    'title'
  ] as const,
  'https://bookstore.example/BookSummaryConst'
);

const summaryId: string = BookSummarySchema.$id;

console.assert(summaryId.endsWith('BookSummaryConst'));
