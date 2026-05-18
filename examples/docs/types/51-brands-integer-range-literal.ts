/**
 * Constraint brands — Example: Integer range as literal union.
 *
 * `ReviewSchema.properties.rating` $refs RatingScoreSchema, which
 * declares `type: 'integer', minimum: 1, maximum: 5`. The inferred
 * `Review['rating']` resolves to the literal union `1 | 2 | 3 | 4 | 5`
 * — out-of-range values fail at compile time.
 */

import type { InferType } from '../../../src/types/index.js';
import type { ReviewSchema } from '../bookstore/index.js';

type Review = InferType<typeof ReviewSchema>;
type Rating = Review['rating'];
// 1 | 2 | 3 | 4 | 5

// OK — within 1..5
const fine: Rating = 3;

// OK — within 1..5
const top: Rating = 5;

// const bad: Rating = 0; // compile error — 0 is not in 1..5
// const bad2: Rating = 6; // compile error — 6 is not in 1..5

void fine;
void top;
