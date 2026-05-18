/**
 * Compose.omit — Example 1: Public book without the internal printStatus
 *
 * Drops a single field from BookSchema for a region-normalised public
 * feed. The omitted field is removed from both `properties` and
 * `required`; everything else carries through.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PublicBookSchema = Compose.omit(
  BookSchema,
  ['printStatus'] as const,
  'https://bookstore.example/PublicBookNoStatus'
);

jt.set(PublicBookSchema);

const errors = jt.validate(PublicBookSchema.$id, {
  'authors': aboxFixtures.rareBook.authors,
  'inStock': aboxFixtures.rareBook.inStock,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'title': aboxFixtures.rareBook.title
  // printStatus omitted — schema does not require it
});

console.assert(errors.ok);
