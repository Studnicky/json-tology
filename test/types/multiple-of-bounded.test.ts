/**
 * Compile-time type assertions for `multipleOf` bounded-range narrowing
 * (Finding 24 / design 0002 cluster H).
 *
 *   - `type: 'integer'` with `minimum`, `maximum`, and `multipleOf` literals,
 *     where `(max - min) / multipleOf <= 50`:
 *       inferred type is the literal union of in-range multiples.
 *   - Above the cap: falls through to `number` per existing behavior.
 *   - Bounds without `multipleOf`: existing `IntegerRangeType` path unchanged.
 */

import {
  describe, it
} from 'node:test';

import type { InferType } from '../../src/types/Schema.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

type AssertNotEqualType<TLeft, TRight>
  = AssertEqualType<TLeft, TRight> extends true ? false : true;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Positive: bounded multipleOf within the cap narrows to a literal union
// ---------------------------------------------------------------------------

const _EvensZeroToTenSchema = {
  'maximum': 10,
  'minimum': 0,
  'multipleOf': 2,
  'type': 'integer'
} as const;

void _EvensZeroToTenSchema;

type EvensZeroToTen = InferType<typeof _EvensZeroToTenSchema>;

assert<AssertEqualType<EvensZeroToTen, 0 | 2 | 4 | 6 | 8 | 10>>();

// All in-range multiples are assignable.
const _e0: EvensZeroToTen = 0;
const _e2: EvensZeroToTen = 2;
const _e4: EvensZeroToTen = 4;
const _e6: EvensZeroToTen = 6;
const _e8: EvensZeroToTen = 8;
const _e10: EvensZeroToTen = 10;

void _e0;
void _e2;
void _e4;
void _e6;
void _e8;
void _e10;

// ---------------------------------------------------------------------------
// 2. Negative: a non-multiple literal is rejected at compile time
// ---------------------------------------------------------------------------

// @ts-expect-error — 3 is not a multiple of 2 within [0, 10]
const _eBad3: EvensZeroToTen = 3;

void _eBad3;

// @ts-expect-error — 12 is out of range
const _eBad12: EvensZeroToTen = 12;

void _eBad12;

// ---------------------------------------------------------------------------
// 3. Above the cap: literal-union branch is NOT taken
// ---------------------------------------------------------------------------

const _LargeMultipleOfSchema = {
  'maximum': 1000,
  'minimum': 0,
  'multipleOf': 1,
  'type': 'integer'
} as const;

void _LargeMultipleOfSchema;

type LargeMultipleOf = InferType<typeof _LargeMultipleOfSchema>;

// The (max - min) / multipleOf delta is 1000, far above the cap of 50.
// The literal-union branch must NOT fire; fall through is `number`.
assert<AssertEqualType<LargeMultipleOf, number>>();

// Non-multiples and arbitrary numbers are accepted at the fallback (the brand
// is dropped along with the literal union, matching existing IntegerRangeType
// fallback behavior).
const _ln0: LargeMultipleOf = 0;
const _ln42: LargeMultipleOf = 42;
const _ln999: LargeMultipleOf = 999;

void _ln0;
void _ln42;
void _ln999;

// Assert that the literal-union branch is NOT what produced LargeMultipleOf:
// a small literal union would not include 999 the way `number` does, but more
// importantly it would not be exactly `number`.
assert<AssertNotEqualType<LargeMultipleOf, 0 | 1 | 2>>();

// ---------------------------------------------------------------------------
// 4. Bounds without multipleOf: existing IntegerRangeType path is unchanged
// ---------------------------------------------------------------------------

const _OneToFiveSchema = {
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;

void _OneToFiveSchema;

type OneToFive = InferType<typeof _OneToFiveSchema>;

assert<AssertEqualType<OneToFive, 1 | 2 | 3 | 4 | 5>>();

// ---------------------------------------------------------------------------
// 5. Offset minimum: only multiples within [min, max] are emitted
// ---------------------------------------------------------------------------

const _MultiplesOfFiveOffsetSchema = {
  'maximum': 20,
  'minimum': 7,
  'multipleOf': 5,
  'type': 'integer'
} as const;

void _MultiplesOfFiveOffsetSchema;

type MultiplesOfFiveOffset = InferType<typeof _MultiplesOfFiveOffsetSchema>;

// 5 is below minimum (7); first multiple of 5 >= 7 is 10.
assert<AssertEqualType<MultiplesOfFiveOffset, 10 | 15 | 20>>();

// @ts-expect-error — 5 is below minimum
const _of5: MultiplesOfFiveOffset = 5;

void _of5;

void describe('multipleOf bounded-range narrowing (Finding 24)', () => {
  void it('compiles - all assertions are static', () => {
    void 0;
  });
});
