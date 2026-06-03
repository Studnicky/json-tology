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

// Anti-pattern: dump on raw uncoerced input — encode runs but coercion did not.
// Raw input is untrusted (`unknown`); the anti-pattern forces it past dump's
// branded value parameter, the very narrowing the correct path earns via
// instantiate. Don't do this.
const rawInput: unknown = {
  'authors': ['Michael Ende'],
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': 'outOfPrint',
  'title': aboxFixtures.rareBook.title
};

const antipatternWire = bookstoreEntities.dump(BookSchema.$id, rawInput as Book);

void antipatternWire;

// Correct approach: instantiate first so coercion and defaults are applied,
// then dump to produce the wire form
const book = bookstoreEntities.instantiate(BookSchema.$id, rawInput);
const wireBook = bookstoreEntities.dump(BookSchema.$id, book);

console.assert('isbn' in wireBook);
console.assert('title' in (wireBook as object));

// Show the correctly-instantiated wire form (anti-pattern omitted from output)
console.log('correct wire (instantiate then dump):', JSON.stringify(wireBook, null, 2));
