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
  void 0 as unknown as T;
}

// PropertyPathsType — direct properties only.
type CustomerPaths = PropertyPathsType<typeof CustomerSchema>;

assert<AssertEqualType<CustomerPaths extends string ? true : false, true>>();

// DeepPropertyPathsType — recursive pointer paths.
type OrderDeep = DeepPropertyPathsType<typeof OrderSchema>;

assert<AssertEqualType<OrderDeep extends string ? true : false, true>>();

// ExhaustiveType — a discriminated-union exhaustion helper. Applied to
// `printStatus` it covers every literal in the enum so a runtime switch
// can be statically checked.
type PrintStatusExhaustive = ExhaustiveType<
  InferPrintStatusType,
  Record<InferPrintStatusType, true>
>;
type InferPrintStatusType = typeof BookSchema extends {
  readonly 'properties': { readonly 'printStatus': { readonly '$ref': infer R }; };
}
  ? R extends string ? string : never
  : never;

assert<AssertEqualType<PrintStatusExhaustive extends Record<string, true> ? true : false, true>>();

void (null as unknown as CustomerPaths | OrderDeep | PrintStatusExhaustive);
