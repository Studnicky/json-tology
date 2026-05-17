/**
 * Compose.discriminatedUnion — Example 1: Book print status union
 *
 * Demonstrates oneOf with a discriminator. Book print-status variants
 * use the canonical `InPrintBookSchema` / `OutOfPrintBookSchema` from
 * the bookstore. The discriminator is `printStatus` ('inPrint' vs
 * 'outOfPrint'). Inputs are the canonical rare-book fixture (Bastian's
 * 1979 Thienemann first edition of *Die unendliche Geschichte*) and a
 * sibling in-print Michael Ende title (Momo, 9783522115056).
 */

import { Compose } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';
import {
  aboxFixtures, bookstoreEntities, InPrintBookSchema, OutOfPrintBookSchema
} from '../bookstore/index.js';

const BookStatusSchema = Compose.discriminatedUnion(
  'printStatus',
  [
    InPrintBookSchema,
    OutOfPrintBookSchema
  ] as const,
  'https://bookstore.example/BookStatus'
);

type BookStatus = InferType<typeof BookStatusSchema>;

bookstoreEntities.set(BookStatusSchema);

// OutOfPrint variant — Bastian's rare 1979 Thienemann hardcover.
const outOfPrintErrs = bookstoreEntities.validate(BookStatusSchema.$id, aboxFixtures.rareBook);

console.assert(outOfPrintErrs.length === 0);

// InPrint variant — Michael Ende's Momo (Thienemann Verlag, 1973), still in print.
const inPrintData = {
  'authors': ['Michael Ende'],
  'inStock': true,
  'isbn': '9783522115056',
  'price': {
    'amount': 16.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Momo'
} as const;

const inPrintErrs = bookstoreEntities.validate(BookStatusSchema.$id, inPrintData);

console.assert(inPrintErrs.length === 0);

// Compile-time discriminator narrowing — `BookStatus` is the discriminated
// union of `InPrintBook | OutOfPrintBook`. The rare-book fixture's literal
// `printStatus: 'outOfPrint'` satisfies the `OutOfPrintBook` branch.
const rare: BookStatus = { ...aboxFixtures.rareBook };

const description = rare.printStatus === 'inPrint'
  ? `In print: ${rare.title}`
  : `Rare: ${rare.title}`;

console.assert(description.startsWith('Rare: Die unendliche Geschichte'));
