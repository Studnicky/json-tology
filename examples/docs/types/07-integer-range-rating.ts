/**
 * IntegerRangeType — Star rating range
 *
 * Demonstrates using IntegerRangeType to produce a literal union
 * for a bounded integer range, here 1–5 for star ratings.
 */

import type {
  ExhaustiveType, IntegerRangeType
} from '../../../src/types/index.js';

type StarRating = IntegerRangeType<1, 5>;
// 1 | 2 | 3 | 4 | 5

function ratingLabel(r: StarRating): string {
  switch (r) {
    case 1: return 'Poor';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Very Good';
    case 5: return 'Excellent';
    default: {
      const _: ExhaustiveType<typeof r> = r;

      return _;
    }
  }
}

// Compile-time verification
const rating1: StarRating = 3;
const label = ratingLabel(rating1);

void label;
