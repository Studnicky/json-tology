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
  CustomerSchema, OrderSchema
} from '../bookstore/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(_proof?: T): void {
  return;
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


// Log the utility type shapes at runtime — showing what the type system exposes.
const customerPathSample: CustomerPaths = 'customerId';
const orderDeepSample: OrderDeep = 'orderLines';

console.log('PropertyPathsType<CustomerSchema> sample path:', customerPathSample);
console.log('DeepPropertyPathsType<OrderSchema> sample path:', orderDeepSample);
// PrintStatusExhaustive is `ExhaustiveType<never>` = `never` (no runtime value);
// the type-level assertion above is its proof that every case is handled.
console.log('ExhaustiveType resolves to never — all PrintStatus cases handled.');
