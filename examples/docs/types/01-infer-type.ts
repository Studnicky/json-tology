/**
 * InferType — Example 1: Deriving TypeScript types from canonical schemas
 *
 * Demonstrates `InferType<typeof Schema>` on the canonical bookstore
 * schemas. The resulting types are derived purely at compile time —
 * no code generation, no separate `.d.ts`. Pass the same schema
 * literal that you registered into `bookstoreEntities` and you get
 * the TypeScript view of the wire shape for free.
 */

import type {
  Address, Book, Customer, Order
} from '../bookstore/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

// Compile-time type test: the `T extends true` constraint rejects any call whose
// type argument resolves to `false`. `T` is consumed as the optional parameter
// type, so no runtime value or cast is needed.
function assert<T extends true>(_proof?: T): void {
  return;
}

// Customer — customerId, email, name required; addresses optional with default.
// Imported from bookstore/index.ts which resolves $ref fields via BookstoreRefs.

assert<AssertEqualType<Customer['customerId'] extends string ? true : false, true>>();
assert<AssertEqualType<Customer['email'] extends string ? true : false, true>>();
assert<AssertEqualType<Customer['name'] extends string ? true : false, true>>();

// Address — composed of named primitives via $ref.

assert<AssertEqualType<Address['street'] extends string ? true : false, true>>();
assert<AssertEqualType<Address['city'] extends string ? true : false, true>>();

// Book — printStatus is the closed enum.

assert<AssertEqualType<
  Book['printStatus'],
  'inPrint' | 'limitedRun' | 'outOfPrint'
>>();

// Order — orderLines is an array of OrderLine.

assert<AssertEqualType<Order['orderLines'] extends readonly unknown[] ? true : false, true>>();

// Log the inferred schema field names — demonstrating what InferType exposes at
// compile time. keyof gives us the property names the type system knows about.
const customerFields: Array<keyof Customer> = [
  'customerId',
  'email',
  'name',
  'addresses'
];
const bookFields: Array<keyof Book> = [
  'isbn',
  'title',
  'printStatus',
  'authors'
];
const addressFields: Array<keyof Address> = [
  'street',
  'city',
  'country',
  'postalCode'
];

console.log('InferType<CustomerSchema> fields:', customerFields.join(', '));
console.log('InferType<BookSchema> fields:', bookFields.join(', '));
console.log('InferType<AddressSchema> fields:', addressFields.join(', '));
