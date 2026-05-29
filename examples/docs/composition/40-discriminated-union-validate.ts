/**
 * Compose.discriminatedUnion — Example 2: Validate each variant
 *
 * `InPrintBookSchema` and `OutOfPrintBookSchema` are the canonical
 * variants of Book.printStatus. The discriminator (printStatus)
 * routes validation to the correct branch.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Local variant schemas with explicit const discriminator so
// ValidateDiscriminatedVariantsType<..., 'printStatus'> is satisfied.
const InPrintVariantSchema = {
  '$id': 'https://bookstore.example/InPrintVariant2',
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
  '$id': 'https://bookstore.example/OutOfPrintVariant2',
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

const BookStatusVariantSchema = Compose.discriminatedUnion(
  'printStatus',
  [
    InPrintVariantSchema,
    OutOfPrintVariantSchema
  ] as const,
  'https://bookstore.example/BookStatusVariant'
);

const jt2 = jt.set(BookStatusVariantSchema);

// Out-of-print variant — Bastian's rare 1979 Thienemann fixture.
const outOfPrint = jt2.validate(BookStatusVariantSchema.$id, aboxFixtures.rareBook);

console.assert(outOfPrint.ok);

// In-print variant — Momo (still printed by Thienemann).
const inPrint = jt2.validate(BookStatusVariantSchema.$id, {
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
