/**
 * MultipleOfRangeType — Signature
 *
 * The canonical declaration of MultipleOfRangeType<TMin, TMax, TStep>:
 * produces a union of integer literals within `[Min, Max]` (inclusive)
 * that are divisible by `Step`. Starts at `0`, increments by `Step`,
 * includes values that fall within the range. Caps at 50 iterations;
 * returns `number` when any parameter is the general `number` type or
 * the cap is exceeded.
 */

import type { MultipleOfRangeType } from '../../../src/types/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type MultipleOfRangeType<
//   TMin extends number, TMax extends number, TStep extends number
// >
//   = number extends TMin ? number
//     : number extends TMax ? number
//       : number extends TStep ? number
//         : BuildMultipleOfRangeType<TMin, TMax, TStep>;

type EvenQuantity = MultipleOfRangeType<0, 10, 2>;
// 0 | 2 | 4 | 6 | 8 | 10

const quantity: EvenQuantity = 6;

// EvenQuantity is the literal union 0 | 2 | 4 | 6 | 8 | 10. Odd values
// and values outside the range are rejected at compile time.
console.log('even quantity:', quantity);
console.log('type:', typeof quantity);
