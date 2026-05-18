/**
 * Compile-time schema validation: required key presence
 *
 * Every key in `required` must appear in `properties`. A `required` entry
 * that references a non-existent property surfaces a
 * `RequiredKeyNotInPropertiesInterface` brand error at the call site.
 *
 * The IDE hover on a failing assignment shows the specific brand type and
 * the offending key rather than a generic "not assignable to never" message.
 *
 * This example demonstrates the valid case — all required keys in
 * `BookSchema` exist in its `properties` — so the compile-time check
 * passes and the assignment succeeds.
 */

import type { ValidateSchemaType } from '../../../src/types/index.js';
import {
  aboxFixtures, BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// BookSchema: all required keys ('isbn', 'title', 'authors', 'price', 'inStock',
// 'printStatus', 'publishedOn', 'stockLevel') are declared in properties.
const _check: ValidateSchemaType<typeof BookSchema> = BookSchema;

void _check;

// Runtime: validate the canonical rare book fixture.
const errs = bookstoreEntities.validate(BookSchema.$id, aboxFixtures.rareBook);

console.assert(errs.length === 0);

const title: string = aboxFixtures.rareBook.title;

console.assert(title === 'Die unendliche Geschichte');
