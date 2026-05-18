/**
 * MultipleOfRangeType — Example: Discount tiers in 5% increments.
 *
 * The discount argument is compile-time bounded to multiples of 5 in
 * the range 0–50. Callers cannot pass `7` or `60`; the union enforces
 * tier conformance without a runtime check.
 */

import type { MultipleOfRangeType } from '../../../src/types/index.js';

// Discounts from 0% to 50% in 5% steps.
type DiscountPercent = MultipleOfRangeType<0, 50, 5>;
// 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50

function applyDiscount(price: number, discount: DiscountPercent): number {
  return price * (1 - discount / 100);
}

const half = applyDiscount(20, 50);
const quarter = applyDiscount(20, 25);
const full = applyDiscount(20, 0);

console.assert(half === 10);
console.assert(quarter === 15);
console.assert(full === 20);
