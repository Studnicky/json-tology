/**
 * MultipleOfRangeType — Even numbers in a range
 *
 * Demonstrates using MultipleOfRangeType to produce a literal union
 * for values divisible by a step within a bounded range.
 */

import type { MultipleOfRangeType } from '../../../src/types/index.js';

type EvenQuantity = MultipleOfRangeType<0, 10, 2>;
// 0 | 2 | 4 | 6 | 8 | 10

const q: EvenQuantity = 6; // OK

void q;
