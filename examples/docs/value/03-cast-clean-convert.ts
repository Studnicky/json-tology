/**
 * value.cast / clean / convert — Example 1: Schema-aware value operations
 * Demonstrates: type coercion, unknown stripping, convert without defaults
 */

import { JsonTology } from '../../../src/index.js';
import { BookSchema } from '../bookstore/schemas.js';

const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'castTypes': true,
  'schemas': [BookSchema] as const
});

// cast coerces types and fills defaults
const casted = localJt.value.cast(BookSchema.$id, {
  'authors': ['Fyodor Dostoevsky'],
  'inStock': 'true',
  'isbn': '9780140449136',
  'price': '14.99',
  'title': 'Crime and Punishment'
});

console.assert(typeof (casted as { 'price': number }).price === 'number');
console.assert((casted as { 'currency': string }).currency === 'USD');

// clean strips unknown properties
const dirty = {
  '_cacheKey': 'k:9780140449136',
  '_internalId': 'int-001',
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': 14.99,
  'title': 'Crime and Punishment'
};
const cleaned = localJt.value.clean(BookSchema.$id, dirty);

console.assert(!('_internalId' in (cleaned as object)));
console.assert(!('_cacheKey' in (cleaned as object)));

// convert coerces types only — no defaults applied
const converted = localJt.value.convert(BookSchema.$id, {
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': '14.99',
  'title': 'Crime and Punishment'
});

console.assert(typeof (converted as { 'price': number }).price === 'number');
