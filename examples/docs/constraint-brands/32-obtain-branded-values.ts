/**
 * Obtaining branded values — only validation produces them.
 *
 * Branded types enforce that data goes through validation. The
 * canonical EmailSchema in the bookstore carries
 * `FormatBrandInterface<'email'>`; the only way to obtain a value of
 * that branded type is to pass through `instantiate`, `value.instantiate`,
 * or the type guard `is`.
 */

import {
  bookstoreEntities, EmailSchema
} from '../bookstore/index.js';

const candidate = 'bastian.bux@bookstore.example';

const email = bookstoreEntities.instantiate(EmailSchema, candidate);
const echo = bookstoreEntities.value.instantiate(EmailSchema.$id, candidate) as string;

console.assert(typeof email === 'string');
console.assert(typeof echo === 'string');

if (bookstoreEntities.is(EmailSchema, candidate)) {
  // candidate is narrowed to the branded email type inside this branch.
  console.assert(typeof candidate === 'string');
}
