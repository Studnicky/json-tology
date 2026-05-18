/**
 * Bookstore domain: Isbn primitive — named, single source of truth
 *
 * `IsbnSchema` is the canonical primitive for ISBN-13 identifiers. It is
 * imported by `BookSchema`, `OrderLineSchema`, and `ReviewSchema` via
 * `{ $ref: IsbnSchema.$id }` — never repeated inline.
 *
 * The 1979 Thienemann Verlag first edition of Michael Ende's
 * "Die unendliche Geschichte" has ISBN-13 `9783522128001`.
 */

import { IsbnSchema } from '../bookstore/index.js';

const isbnId: string = IsbnSchema.$id;
const isbnType: string = IsbnSchema.type;
const isbnPattern: string = IsbnSchema.pattern;

console.assert(isbnId === 'urn:bookstore:Isbn');
console.assert(isbnType === 'string');
// Pattern enforces ISBN-13 format: exactly 13 decimal digits.
console.assert(isbnPattern === '^\\d{13}$');
