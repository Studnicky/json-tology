/**
 * dump — Anti-pattern 1: Calling dump on raw (uninstantiated) input
 * Demonstrates: dump expects an instantiated value; raw input bypasses coercion
 *
 * Michael Ende's "Die unendliche Geschichte" — the anti-pattern passes a raw
 * object directly to dump; the correct pattern instantiates first, then dumps.
 */

import {
  aboxFixtures, type Book, BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// Anti-pattern: dump on raw uncoerced input — encode runs but coercion did not
// Don't do this
const rawInput = {
  'authors': ['Michael Ende'],
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': 'outOfPrint',
  'title': aboxFixtures.rareBook.title
};

// Casting as Book bypasses type safety — dump applies encode, not coercion
const antipatternWire = bookstoreEntities.dump(BookSchema.$id, rawInput as Book);

void antipatternWire;

// Correct approach: instantiate first so coercion and defaults are applied,
// then dump to produce the wire form
const book = bookstoreEntities.instantiate(BookSchema, rawInput);
const wireBook = bookstoreEntities.dump(BookSchema.$id, book);

console.assert(typeof wireBook === 'object' && wireBook !== null);
console.assert('isbn' in (wireBook as object));
console.assert('title' in (wireBook as object));
