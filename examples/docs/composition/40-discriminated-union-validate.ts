/**
 * Compose.discriminatedUnion — Example 2: Validate each variant
 *
 * `InPrintBookSchema` and `OutOfPrintBookSchema` are the canonical
 * variants of Book.printStatus. The discriminator (printStatus)
 * routes validation to the correct branch.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry, InPrintBookSchema,
  OutOfPrintBookSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BookStatusVariantSchema = Compose.discriminatedUnion(
  'printStatus',
  [
    InPrintBookSchema,
    OutOfPrintBookSchema
  ] as const,
  'https://bookstore.example/BookStatusVariant'
);

jt.set(BookStatusVariantSchema);

// Out-of-print variant — Bastian's rare 1979 Thienemann fixture.
const outOfPrint = jt.validate(BookStatusVariantSchema.$id, aboxFixtures.rareBook);

console.assert(outOfPrint.ok);

// In-print variant — Momo (still printed by Thienemann).
const inPrint = jt.validate(BookStatusVariantSchema.$id, {
  'authors': ['Michael Ende'],
  'inStock': true,
  'isbn': '9783522115056',
  'price': {
    'amount': 16.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Momo'
});

console.assert(inPrint.ok);
