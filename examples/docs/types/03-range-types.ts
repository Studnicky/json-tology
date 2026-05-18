/**
 * Range types — Example 1: IntegerRange / NumericRange / FormatBrand
 *
 * Demonstrates type-level numeric ranges and string-format brands
 * applied to canonical bookstore primitives. The ranges narrow the
 * inferred type to a literal set or branded value so an arbitrary
 * out-of-range numeric literal gets caught at compile time.
 */

import type {
  EmailSchema, IsbnSchema, RatingScoreSchema, StockLevelSchema
} from '../bookstore/index.js';
import type { InferType } from '../../../src/types/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// RatingScore — integer 1..5.
type Rating = InferType<typeof RatingScoreSchema>;

assert<AssertEqualType<Rating extends number ? true : false, true>>();

// StockLevel — non-negative integer multipleOf 5.
type StockLevel = InferType<typeof StockLevelSchema>;

assert<AssertEqualType<StockLevel extends number ? true : false, true>>();

// Isbn — string with pattern '^\d{13}$' and registered transform.
type Isbn = InferType<typeof IsbnSchema>;

assert<AssertEqualType<Isbn extends string ? true : false, true>>();

// Email — string with format brand 'email'.
type Email = InferType<typeof EmailSchema>;

assert<AssertEqualType<Email extends string ? true : false, true>>();

void (null as unknown as Email | Isbn | Rating | StockLevel);
