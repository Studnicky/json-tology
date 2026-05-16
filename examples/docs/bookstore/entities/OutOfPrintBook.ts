import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';
import { InPrintBookSchema } from './InPrintBook.js';

/**
 * OutOfPrintBook — the OWL complement of InPrintBookSchema, bounded to the
 * Book universe via `allOf + $ref(Book)`. Covers any book whose
 * `printStatus` is not `'inPrint'` (so: `'outOfPrint'` or `'limitedRun'`
 * editions that have sold through).
 *
 * Demonstrates `Compose.complementOf` with a body that already carries
 * `allOf` so the result has both `not` (the OWL complement) and `allOf`
 * (the structural subclass) at the top level. The OWL projection emits:
 *
 *   urn:bookstore:OutOfPrintBook  owl:complementOf  urn:bookstore:InPrintBook .
 *   urn:bookstore:OutOfPrintBook  rdfs:subClassOf   urn:bookstore:Book .
 *
 * Wire shape:
 *   {
 *     $id:    'urn:bookstore:OutOfPrintBook',
 *     not:    { $ref: 'urn:bookstore:InPrintBook' },
 *     allOf:  [{ $ref: 'urn:bookstore:Book' }],
 *     type:   'object'
 *   }
 *
 * JSON Schema runtime: validates as `Book AND NOT InPrintBook` — only Book-
 * shaped values that fail the InPrintBook constraint pass.
 */

export const OutOfPrintBookSchema = Compose.complementOf(InPrintBookSchema, {
  '$id': 'urn:bookstore:OutOfPrintBook',
  'allOf': [{ '$ref': BookSchema.$id }],
  'type': 'object'
} as const);
