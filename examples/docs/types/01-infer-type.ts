/**
 * InferType — Example 1: Deriving TypeScript types from canonical schemas
 *
 * Demonstrates `InferType<typeof Schema>` on the canonical bookstore
 * schemas. The resulting types are derived purely at compile time —
 * no code generation, no separate `.d.ts`. Pass the same schema
 * literal that you registered into `bookstoreEntities` and you get
 * the TypeScript view of the wire shape for free.
 *
 * Compile-time only: the asserts run through `tsc --noEmit` (matching
 * `test/types/bookstore-axioms.test.ts`). The runtime body just holds
 * a `void` so the file is importable from `docExamples.test.ts`.
 */

import type { InferType } from '../../../src/types/index.js';
import type {
  AddressSchema, BookSchema, CustomerSchema, OrderSchema
} from '../bookstore/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// Customer — id, email, name required; addresses optional with default.
type Customer = InferType<typeof CustomerSchema>;

assert<AssertEqualType<Customer['id'] extends string ? true : false, true>>();
assert<AssertEqualType<Customer['email'] extends string ? true : false, true>>();
assert<AssertEqualType<Customer['name'] extends string ? true : false, true>>();

// Address — composed of named primitives via $ref.
type Address = InferType<typeof AddressSchema>;

assert<AssertEqualType<Address['street'] extends string ? true : false, true>>();
assert<AssertEqualType<Address['city'] extends string ? true : false, true>>();

// Book — printStatus is the closed enum.
type Book = InferType<typeof BookSchema>;

assert<AssertEqualType<
  Book['printStatus'],
  'inPrint' | 'limitedRun' | 'outOfPrint'
>>();

// Order — items is an array of OrderLine.
type Order = InferType<typeof OrderSchema>;

assert<AssertEqualType<Order['items'] extends readonly unknown[] ? true : false, true>>();

void (null as unknown as Address | Book | Customer | Order);
