/**
 * value.create — Example 1: Zero-value instance for form initialization
 * Demonstrates: zero-values for required fields, explicit defaults preserved
 *
 * BookSchema is an allOf-composed schema (Compose.subClassOf). value.create
 * traverses all allOf members — including $ref parents — synthesizes zero-values
 * for every required field, and applies declared defaults. The result covers
 * both inherited bibliographic fields (isbn, title, authors) and own retail
 * fields (inStock with default true, price, printStatus zero-values).
 */

import type { InferType } from '../../../src/types/index.js';
import {
  BibliographicRecordSchema, BookSchema, bookstoreEntities
} from '../bookstore/index.js';
import type { BookstoreRefs } from '../bookstore/index.js';

type BibliographicRecord = InferType<typeof BibliographicRecordSchema, BookstoreRefs>;

// value.create on a flat schema — behavior unchanged.
const blank: BibliographicRecord = bookstoreEntities.value.create(BibliographicRecordSchema.$id);

// Required fields with no default get zero-values
console.assert(blank.isbn === '');
console.assert(blank.title === '');
console.assert(Array.isArray(blank.authors));

console.log('blank isbn:', blank.isbn);
console.log('blank title:', blank.title);
console.log('blank authors:', blank.authors);

// value.create on an allOf-composed schema — synthesizes inherited + own fields.
const bookBlank = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

// Inherited from BibliographicRecordSchema via the $ref allOf member
console.assert(bookBlank.isbn === '');
console.assert(bookBlank.title === '');
console.assert(Array.isArray(bookBlank.authors));

// Own field with declared default: true
console.assert(bookBlank.inStock === true);

console.log('bookBlank isbn (inherited zero-value):', bookBlank.isbn);
console.log('bookBlank inStock (own default):', bookBlank.inStock);
