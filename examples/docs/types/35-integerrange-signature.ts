/**
 * IntegerRangeType — Signature
 *
 * The canonical declaration of IntegerRangeType<TMin, TMax>: produces a
 * union of integer literals from `Min` to `Max` (inclusive). Both
 * bounds must be non-negative integer literals within the cap of 50.
 * When either bound is the general `number` type, or the range
 * exceeds the cap, the utility falls back to `number`.
 */

import type { IntegerRangeType } from '../../../src/types/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type IntegerRangeType<TMin extends number, TMax extends number>
//   = number extends TMin ? number
//     : number extends TMax ? number
//       : RangeWithinCapType<TMax> extends true
//         ? BuildIntegerRangeType<TMin, TMax>
//         : number;

type StarRating = IntegerRangeType<1, 5>;
// 1 | 2 | 3 | 4 | 5

const rating: StarRating = 4;

// StarRating is the literal union 1 | 2 | 3 | 4 | 5. At runtime it is
// just a number, but only values 1..5 are assignable at compile time.
console.log('star rating:', rating);
console.log('type:', typeof rating);
