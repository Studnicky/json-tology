/**
 * Anti-pattern: Stepped range that exceeds the cap.
 *
 * MultipleOfRangeType caps at 50 iterations. A 0–100 range with step 1
 * would produce 101 values, exceeds the cap, and falls back to
 * `number`. Use a runtime validator or branded number for wide
 * ranges.
 */

import type { MultipleOfRangeType } from '../../../src/types/index.js';

// ⊥ Don't do this — exceeds the 50-iteration cap.
type AllPercentages = MultipleOfRangeType<0, 100, 1>;

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

// Falls back to `number` — no literal union is available.
assert<AssertEqualType<AllPercentages, number>>();

const anyNumber: AllPercentages = 73;

console.assert(typeof anyNumber === 'number');
