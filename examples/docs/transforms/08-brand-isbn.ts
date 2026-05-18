/**
 * Transform.brand — Example 2: Branded ISBN for books
 * Demonstrates: pattern-validated brand, compile-time nominal type for ISBN13
 *
 * An ISBN-13 brand prevents passing a plain unvalidated string where a
 * validated ISBN is expected. The canonical 1979 Thienemann Verlag first
 * edition of Michael Ende's Die unendliche Geschichte provides the fixture ISBN.
 */

import { Transform } from '../../../src/index.js';
import type { BrandOutputType } from '../../../src/types/index.js';
import {
  aboxFixtures,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BrandedIsbn13Schema = Transform.brand(
  {
    '$id': 'https://bookstore.example/BrandedIsbn13',
    'pattern': '^\\d{13}$',
    'type': 'string'
  } as const,
  'ISBN13'
);

type ISBN13 = BrandOutputType<typeof BrandedIsbn13Schema>;

jt.set(BrandedIsbn13Schema);

// lookupBook(isbn: ISBN13) prevents passing plain unvalidated strings.
function lookupBook(isbn: ISBN13): string {
  return isbn;
}

const isbn = jt.instantiate(
  BrandedIsbn13Schema,
  aboxFixtures.rareBook.isbn
);

const result = lookupBook(isbn as ISBN13);

console.assert(result === aboxFixtures.rareBook.isbn);
console.assert(typeof isbn === 'string');
