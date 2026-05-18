/**
 * value.clean — Example 1: Strip internal fields from an API response
 * Demonstrates: unknown properties removed, declared fields preserved
 *
 * An API response for Michael Ende's Die unendliche Geschichte carries
 * internal cache and ID fields not declared in BookSchema. value.clean
 * strips them while keeping all declared fields intact.
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';
import { aboxFixtures } from '../bookstore/index.js';

const apiResponse = {
  // not in BookSchema
  '_cacheKey': 'k:9783522128001',
  // not in BookSchema
  '_internalId': 'int-001',
  'authors': aboxFixtures.rareBook.authors,
  'inStock': aboxFixtures.rareBook.inStock,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
};

const cleaned = bookstoreEntities.value.clean(BookSchema.$id, apiResponse) as Record<string, unknown>;

// Internal fields are gone.
console.assert(!('_internalId' in (cleaned as object)));
console.assert(!('_cacheKey' in (cleaned as object)));

// Declared fields are preserved.
console.assert((cleaned as { 'isbn': string }).isbn === aboxFixtures.rareBook.isbn);
console.assert((cleaned as { 'title': string }).title === aboxFixtures.rareBook.title);
