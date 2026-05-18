/**
 * Anti-pattern: Step of zero.
 *
 * MultipleOfRangeType requires a positive non-zero step. Step `0` would
 * produce an infinite loop in the type recursion and result in
 * undefined behaviour. Always pass a positive integer step.
 */

import type { MultipleOfRangeType } from '../../../src/types/index.js';

// ⊥ Don't do this — step of 0 is undefined behaviour for the recursion.
// type BadRange = MultipleOfRangeType<0, 10, 0>;
//
// The line above is commented out because the type-level recursion is
// not bounded for step 0. Always supply a positive step.

// ✓ Do this — positive step keeps the recursion bounded.
type EvenInRange = MultipleOfRangeType<0, 10, 2>;
// 0 | 2 | 4 | 6 | 8 | 10

const value: EvenInRange = 6;

void value;
