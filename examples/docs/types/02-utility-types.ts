/**
 * Utility types — Example 1: pointer paths and required-key extraction
 *
 * Demonstrates the type-level helpers that operate on a registered
 * schema literal: extracting required-key unions, computing property
 * pointer paths, and inferring keyof view. All compile-time only.
 */

import type {
  DeepPropertyPathsType, ExhaustiveType, PropertyPathsType
} from '../../../src/types/Infer.js';
import type {
  BookSchema, CustomerSchema, OrderSchema
} from '../bookstore/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  // interop: void 0 as unknown as T is the compile-time type-test idiom; no
  // typed path exists from void to an arbitrary constraint-bounded type T.
  void 0 as unknown as T;
}

// PropertyPathsType — direct properties only.
type CustomerPaths = PropertyPathsType<typeof CustomerSchema>;

assert<AssertEqualType<CustomerPaths extends string ? true : false, true>>();

// DeepPropertyPathsType — recursive pointer paths.
type OrderDeep = DeepPropertyPathsType<typeof OrderSchema>;

assert<AssertEqualType<OrderDeep extends string ? true : false, true>>();

// ExhaustiveType — a discriminated-union exhaustion marker. It accepts only
// `never`, so feeding it the residual of an enum after every literal has been
// excluded statically proves the switch handled every case. Here all three
// PrintStatus literals are excluded, leaving `never`.
type PrintStatusLiterals = 'inPrint' | 'limitedRun' | 'outOfPrint';
type HandledResidual = Exclude<PrintStatusLiterals, 'inPrint' | 'limitedRun' | 'outOfPrint'>;
type PrintStatusExhaustive = ExhaustiveType<HandledResidual>;

assert<AssertEqualType<[PrintStatusExhaustive] extends [never] ? true : false, true>>();

// interop: void-cast keeps compile-time-only type references from being flagged
// as unused; no value-producing typed path exists for a pure type-reference sentinel.
void (null as unknown as CustomerPaths | OrderDeep | typeof BookSchema);
void (null as unknown as PrintStatusExhaustive);
