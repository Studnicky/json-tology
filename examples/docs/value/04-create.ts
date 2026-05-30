/**
 * value.create — Example 1: Zero-value instance for form initialization
 * Demonstrates: zero-values for required fields, explicit defaults preserved
 */

import type { InferType } from '../../../src/types/index.js';
import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

type Book = InferType<typeof BookSchema>;

const blank: Book = bookstoreEntities.value.create(BookSchema.$id);

// Required fields with no default get zero-values
console.assert((blank as { 'isbn': string }).isbn === '');
console.assert((blank as { 'title': string }).title === '');
console.assert(Array.isArray((blank as Record<string, unknown>).authors));

// Explicit defaults are preserved
console.assert((blank as { 'inStock': boolean }).inStock);

console.log('blank isbn:', (blank as { 'isbn': string }).isbn);
console.log('blank title:', (blank as { 'title': string }).title);
console.log('blank authors:', (blank as Record<string, unknown>).authors);
console.log('blank inStock (default true):', (blank as { 'inStock': boolean }).inStock);
