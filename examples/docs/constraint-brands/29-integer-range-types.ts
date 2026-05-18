/**
 * IntegerRangeType / MultipleOfRangeType — manual utilities for
 * generating literal union types from integer ranges.
 *
 * Practical for ranges in 0..50. Larger ranges fall back to `number`.
 * The bookstore's canonical `RatingScoreSchema` covers `1..5`, so the
 * rating literal union is the natural test case.
 */

import type {
  IntegerRangeType, MultipleOfRangeType
} from '../../../src/types/index.js';

type Rating = IntegerRangeType<1, 5>;
type EvenDigit = MultipleOfRangeType<0, 8, 2>;

void 0 as unknown as [Rating, EvenDigit];
