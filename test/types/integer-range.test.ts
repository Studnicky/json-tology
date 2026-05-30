/**
 * Compile-time type assertions for IntegerRange auto-application
 * (Finding 21 / design 0002 cluster G).
 *
 *   - `type: 'integer'` with both `minimum` and `maximum`, max <= 50:
 *       inferred type is the literal union TMin | ... | TMax.
 *   - max > 50: falls back to `number` (no expansion).
 *   - one bound only: stays `number` (with brand intersections).
 */

import {
  describe, it
} from 'node:test';

import type {
  MaximumBrandInterface, MinimumBrandInterface
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Bounded integer with both bounds within the cap
// ---------------------------------------------------------------------------

const _RatingSchema = {
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;

void _RatingSchema;
assert<AssertEqualType<InferType<typeof _RatingSchema>, 1 | 2 | 3 | 4 | 5>>();

const _ZeroToTenSchema = {
  'maximum': 10,
  'minimum': 0,
  'type': 'integer'
} as const;

void _ZeroToTenSchema;
assert<AssertEqualType<
  InferType<typeof _ZeroToTenSchema>,
  0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
>>();

const _CapEdgeSchema = {
  'maximum': 50,
  'minimum': 50,
  'type': 'integer'
} as const;

void _CapEdgeSchema;
assert<AssertEqualType<InferType<typeof _CapEdgeSchema>, 50>>();

// ---------------------------------------------------------------------------
// 2. Above the cap - falls back to `number`
// ---------------------------------------------------------------------------

const _LargeRangeSchema = {
  'maximum': 1000,
  'minimum': 0,
  'type': 'integer'
} as const;

void _LargeRangeSchema;
const _n: InferType<typeof _LargeRangeSchema> = 42;
const _m: InferType<typeof _LargeRangeSchema> = 999;
const _z: InferType<typeof _LargeRangeSchema> = 0;

void _n;
void _m;
void _z;

const _ShiftedAboveCapSchema = {
  'maximum': 110,
  'minimum': 100,
  'type': 'integer'
} as const;

void _ShiftedAboveCapSchema;
const _s100: InferType<typeof _ShiftedAboveCapSchema> = 100;
const _s999: InferType<typeof _ShiftedAboveCapSchema> = 999;

void _s100;
void _s999;

// ---------------------------------------------------------------------------
// 3. Single-bound integers stay numeric, carrying the relevant bound brand
//
// With only one of `minimum` / `maximum`, no finite literal union can be built,
// so the type is `number` intersected with the corresponding constraint brand.
// ---------------------------------------------------------------------------

const _MinOnlySchema = {
  'minimum': 1,
  'type': 'integer'
} as const;

void _MinOnlySchema;
assert<AssertEqualType<InferType<typeof _MinOnlySchema>, MinimumBrandInterface<1> & number>>();

const _MaxOnlySchema = {
  'maximum': 5,
  'type': 'integer'
} as const;

void _MaxOnlySchema;
assert<AssertEqualType<InferType<typeof _MaxOnlySchema>, MaximumBrandInterface<5> & number>>();

void describe('IntegerRange auto-application (Finding 21)', () => {
  void it('compiles - all assertions are static', () => {
    void 0;
  });
});
