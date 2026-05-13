/**
 * value.create — Example 1: Zero-value instance for form initialization
 * Demonstrates: zero-values for required fields, explicit defaults preserved
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const blank = bookstoreEntities.value.create(BookSchema.$id);

// Required fields with no default get zero-values
console.assert((blank as { 'isbn': string }).isbn === '');
console.assert((blank as { 'title': string }).title === '');
console.assert(Array.isArray((blank as { 'authors': string[] }).authors));

// Explicit defaults are preserved
console.assert((blank as { 'inStock': boolean }).inStock);
