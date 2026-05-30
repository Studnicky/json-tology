/**
 * value.cast / clean / convert — Example 1: Schema-aware value operations
 * Demonstrates: type coercion, unknown stripping, convert without defaults
 *
 * Operates against the canonical bookstore registry. The book is
 * Hermann Hesse's Siddhartha (Suhrkamp, 1922) — a literary sibling to
 * the Neverending Story rare-book fixture in Coreander's antiquariat.
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// cast coerces types and fills defaults.
const casted = bookstoreEntities.value.cast(BookSchema.$id, {
  'authors': ['Hermann Hesse'],
  'inStock': true,
  'isbn': '9783518366820',
  'price': {
    'amount': 12,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Siddhartha'
}) as Record<string, unknown>;

console.assert((casted as { 'price': { 'amount': number } }).price.amount === 12);

// clean strips unknown properties.
const dirty = {
  '_cacheKey': 'k:9783518366820',
  '_internalId': 'int-001',
  'authors': ['Hermann Hesse'],
  'isbn': '9783518366820',
  'price': {
    'amount': 12,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Siddhartha'
};
const cleaned = bookstoreEntities.value.clean(BookSchema.$id, dirty) as Record<string, unknown>;

console.assert(!('_internalId' in (cleaned as object)));
console.assert(!('_cacheKey' in (cleaned as object)));

// convert coerces types only — no defaults applied.
const converted = bookstoreEntities.value.convert(BookSchema.$id, {
  'authors': ['Hermann Hesse'],
  'isbn': '9783518366820',
  'price': {
    'amount': 12,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Siddhartha'
}) as Record<string, unknown>;

console.assert(typeof (converted as { 'price': { 'amount': number } }).price.amount === 'number');

console.log('cast price.amount:', (casted as { 'price': { 'amount': number } }).price.amount);
console.log('clean stripped _internalId:', !('_internalId' in cleaned));
console.log('clean stripped _cacheKey:', !('_cacheKey' in cleaned));
console.log('convert price.amount type:', typeof (converted as { 'price': { 'amount': number } }).price.amount);
