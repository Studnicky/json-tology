/**
 * MultipleOfRangeType — Even numbers in a range
 *
 * Demonstrates using MultipleOfRangeType to produce a literal union
 * for values divisible by a step within a bounded range.
 */

import type { MultipleOfRangeType } from '../../../src/types/index.js';

type EvenQuantity = MultipleOfRangeType<0, 10, 2>;
// 0 | 2 | 4 | 6 | 8 | 10

// All valid members of the literal union: 0, 2, 4, 6, 8, 10
const validQuantities: EvenQuantity[] = [
  0,
  2,
  4,
  6,
  8,
  10
];

console.log('MultipleOfRangeType<0, 10, 2> members:', validQuantities.join(' | '));
console.log('sample value:', validQuantities[3], '(6 is even, in 0..10)');
