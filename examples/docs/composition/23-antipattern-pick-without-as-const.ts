/**
 * Compose.pick — Anti-pattern 1: Forgetting `as const` on the keys array
 *
 * Without `as const`, the keys array widens to `string[]` and
 * TypeScript loses the literal types — pick can no longer narrow the
 * inferred property set. Always pass keys as a `const` tuple.
 *
 * Book is now a Compose.subClassOf(BibliographicRecordSchema, …) — isbn and
 * title are bibliographic fields that live on BibliographicRecordSchema, not
 * on Book's own properties. We target BibliographicRecordSchema directly so
 * the keys are valid; the `as const` lesson is unchanged.
 */

import { Compose } from '../../../src/index.js';
import { BibliographicRecordSchema } from '../bookstore/index.js';

// ✓ Do this — `as const` preserves literal types so pick narrows correctly.
const BookSummarySchema = Compose.pick(
  BibliographicRecordSchema,
  [
    'isbn',
    'title'
  ] as const,
  'https://bookstore.example/BookSummaryConst'
);

const summaryId: string = BookSummarySchema.$id;

console.assert(summaryId.endsWith('BookSummaryConst'));
console.log('pick with as const preserves literal key types:', Object.keys(BookSummarySchema.properties));
