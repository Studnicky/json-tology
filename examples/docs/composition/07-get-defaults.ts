/**
 * Compose.getDefaults — Example 1: Pre-populate form state from canonical schemas
 *
 * `Compose.getDefaults(schema)` walks the schema's `properties` and
 * returns the subset whose `default` keyword is set. Properties
 * without an explicit default are absent from the result. Nested
 * object properties recurse.
 *
 * The canonical bookstore puts `default: true` on `Book.inStock` and
 * `default: []` on `Customer.addresses` — exercising both the scalar
 * and array-default cases.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema, CustomerSchema
} from '../bookstore/index.js';

const bookDefaults = Compose.getDefaults(BookSchema);

console.assert(
  (bookDefaults as { 'inStock'?: boolean }).inStock === true,
  'Book.inStock has default true'
);

const customerDefaults = Compose.getDefaults(CustomerSchema);

console.assert(
  Array.isArray((customerDefaults as { 'addresses'?: readonly unknown[] }).addresses),
  'Customer.addresses has default []'
);

// Form scaffolding: start from declared defaults, leave required fields empty
// so the user fills them in.
const formState = {
  ...bookDefaults,
  'authors': [] as readonly string[],
  'inStock': true,
  'isbn': '',
  'price': {
    'amount': 0,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint' as const,
  'title': ''
};

console.assert(formState.inStock);
console.assert(formState.title === '');
console.assert(formState.authors.length === 0);
console.assert(formState.isbn === '');
console.assert(formState.price.amount === 0);
console.assert(formState.price.currency === 'EUR');
console.assert(typeof formState.printStatus === 'string');
console.log('Book defaults:', bookDefaults);
console.log('Customer defaults:', customerDefaults);
console.log('Form state seeded from defaults:', formState);
