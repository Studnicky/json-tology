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

// Both are literal union types at compile time.
// Rating: 1 | 2 | 3 | 4 | 5
// EvenDigit: 0 | 2 | 4 | 6 | 8
const rating: Rating = 4;
const evenDigit: EvenDigit = 6;

console.log('Rating (1 | 2 | 3 | 4 | 5):', rating);
console.log('EvenDigit (0 | 2 | 4 | 6 | 8):', evenDigit);
