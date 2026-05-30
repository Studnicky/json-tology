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
  aboxFixtures, createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Local variant schemas with explicit const discriminator so
// ValidateDiscriminatedVariantsType<..., 'printStatus'> is satisfied.
const InPrintVariantSchema = {
  '$id': 'https://bookstore.example/InPrintVariant',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    },
    'inStock': { 'type': 'boolean' },
    'isbn': { 'type': 'string' },
    'price': { 'type': 'object' },
    'printStatus': { 'const': 'inPrint' },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price',
    'printStatus',
    'inStock'
  ],
  'type': 'object'
} as const;

const OutOfPrintVariantSchema = {
  '$id': 'https://bookstore.example/OutOfPrintVariant',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    },
    'inStock': { 'type': 'boolean' },
    'isbn': { 'type': 'string' },
    'price': { 'type': 'object' },
    'printStatus': { 'const': 'outOfPrint' },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price',
    'printStatus'
  ],
  'type': 'object'
} as const;

const BookStatusSchema = Compose.discriminatedUnion(
  'printStatus',
  [
    InPrintVariantSchema,
    OutOfPrintVariantSchema
  ] as const,
  'https://bookstore.example/BookStatus'
);

type BookStatus = InferType<typeof BookStatusSchema>;

const jt2 = jt.set(BookStatusSchema);

// OutOfPrint variant — Bastian's rare 1979 Thienemann hardcover.
const outOfPrintErrs = jt2.validate(BookStatusSchema.$id, aboxFixtures.rareBook);

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

const inPrintErrs = jt2.validate(BookStatusSchema.$id, inPrintData);

console.assert(inPrintErrs.length === 0);

// Compile-time discriminator narrowing — `BookStatus` is the discriminated
// union of `InPrintVariant | OutOfPrintVariant`. instantiate returns the
// branded union value, narrowable on the literal `printStatus` discriminator.
const rare: BookStatus = jt2.instantiate(BookStatusSchema.$id, aboxFixtures.rareBook);

const description = rare.printStatus === 'inPrint'
  ? `In print: ${rare.title}`
  : `Rare: ${rare.title}`;

console.assert(description.startsWith('Rare: Die unendliche Geschichte'));
