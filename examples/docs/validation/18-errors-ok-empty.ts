/**
 * ValidationErrors — Example 2: Valid data returns empty collection
 * Demonstrates: .ok === true, .length === 0 on valid input
 *
 * Michael Ende's "Die unendliche Geschichte" — Thienemann Verlag, 1979.
 * All required fields present and valid; collection is empty.
 */

import {
  aboxFixtures, BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(BookSchema.$id, {
  'authors': ['Michael Ende'],
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': 'outOfPrint',
  'title': aboxFixtures.rareBook.title
});

console.assert(errs.ok);
console.assert(errs.length === 0);
