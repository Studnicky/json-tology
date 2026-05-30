/**
 * Constraint Brands: Structural Narrowing
 *
 * Demonstrates compile-time narrowing of branded primitives from the
 * canonical bookstore schemas: IsbnSchema, EmailSchema, and their
 * inclusion in Book/Customer entities produces narrowed string types
 * at the type level via format and pattern brands.
 */

import type {
  InferType, SchemaReferencesMapType
} from '../../../src/types/index.js';
import {
  bookstoreEntities, EmailSchema, IsbnSchema
} from '../bookstore/index.js';
import type {
  BookSchema, bookstoreSchemas, CustomerSchema
} from '../bookstore/index.js';

type BookstoreRefs = SchemaReferencesMapType<typeof bookstoreSchemas>;

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// IsbnSchema carries a pattern brand for ISBN-13: ^\\d{13}$
type Isbn = InferType<typeof IsbnSchema>;
// Resolves to: string & PatternBrandInterface<'^\\d{13}$'>

// EmailSchema carries a format brand for email
type Email = InferType<typeof EmailSchema>;
// Resolves to: string & FormatBrandInterface<'email'>

// When IsbnSchema is referenced within BookSchema via $ref,
// the inferred book.isbn property narrows to the branded type.
// BookstoreRefs resolves $ref fields to their named datatype types.
type Book = InferType<typeof BookSchema, BookstoreRefs>;
type BookIsbn = Book extends { readonly 'isbn': infer I } ? I : never;
// BookIsbn carries the same PatternBrandInterface<'^\\d{13}$'>

assert<AssertEqualType<BookIsbn extends string ? true : false, true>>();

// Similarly, CustomerSchema.$ref EmailSchema produces a branded email type
type Customer = InferType<typeof CustomerSchema, BookstoreRefs>;
type CustomerEmail = Customer extends { readonly 'email': infer E } ? E : never;
// CustomerEmail carries FormatBrandInterface<'email'>

assert<AssertEqualType<CustomerEmail extends string ? true : false, true>>();

// The three types are structurally incompatible at compile time
// because their brands differ
assert<AssertEqualType<Isbn extends Email ? false : true, true>>();
assert<AssertEqualType<Email extends Isbn ? false : true, true>>();

// Only values that pass bookstoreEntities.instantiate() validation
// receive the branded type at runtime. The bookstoreEntities registry
// validates data against these branded schemas.

const isbn = bookstoreEntities.instantiate(IsbnSchema, '9780525559474');
const email = bookstoreEntities.instantiate(EmailSchema, 'bastian@bookstore.example');

// Both are strings at runtime, but carry incompatible brands at compile time.
console.log('Isbn brand (pattern ^\\d{13}$):', isbn);
console.log('Email brand (format email):', email);
console.log('Isbn extends string:', typeof isbn === 'string');
console.log('Email extends string:', typeof email === 'string');
