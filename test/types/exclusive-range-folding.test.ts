/**
 * Compile-time assertions confirming exclusive-bound folding in integer ranges.
 *
 * `NormalizeMinType` / `NormalizeMaxType` in Infer.ts fold exclusive bounds to
 * their inclusive equivalents before building the literal union:
 *
 *   - `exclusiveMaximum: N`  →  inclusive upper = N − 1  (via Sub1Type)
 *   - `exclusiveMinimum: N`  →  inclusive lower = N + 1  (via Add1Type)
 *
 * This file documents and locks that behaviour against regression.
 */

import {
  describe, it
} from 'node:test';

import type { InferType } from '../../src/types/Schema.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. minimum: 0, exclusiveMaximum: 5  →  0 | 1 | 2 | 3 | 4
//
// NormalizeMaxType folds exclusiveMaximum: 5 to inclusive max 4 (Sub1(5) = 4).
// NormalizeMinType reads minimum: 0 directly.
// Result: integer range [0, 4] = 0 | 1 | 2 | 3 | 4.
// ---------------------------------------------------------------------------

const _ExclusiveMaxSchema = {
  'exclusiveMaximum': 5,
  'minimum': 0,
  'type': 'integer'
} as const;

void _ExclusiveMaxSchema;

type ExclusiveMaxType = InferType<typeof _ExclusiveMaxSchema>;

assert<AssertEqualType<ExclusiveMaxType, 0 | 1 | 2 | 3 | 4>>();

// Only the folded values are assignable; the exclusive bound itself is excluded
const _v0: ExclusiveMaxType = 0;
const _v4: ExclusiveMaxType = 4;

void [
  _v0,
  _v4
];

if (false as boolean) {
  // @ts-expect-error — 5 is the exclusiveMaximum itself; excluded from the range
  const _v5: ExclusiveMaxType = 5;

  void _v5;
}

// ---------------------------------------------------------------------------
// 2. exclusiveMinimum: 0, maximum: 3  →  1 | 2 | 3
//
// NormalizeMinType folds exclusiveMinimum: 0 to inclusive min 1 (Add1(0) = 1).
// NormalizeMaxType reads maximum: 3 directly.
// Result: integer range [1, 3] = 1 | 2 | 3.
// ---------------------------------------------------------------------------

const _ExclusiveMinSchema = {
  'exclusiveMinimum': 0,
  'maximum': 3,
  'type': 'integer'
} as const;

void _ExclusiveMinSchema;

type ExclusiveMinType = InferType<typeof _ExclusiveMinSchema>;

assert<AssertEqualType<ExclusiveMinType, 1 | 2 | 3>>();

const _v1: ExclusiveMinType = 1;
const _v3: ExclusiveMinType = 3;

void [
  _v1,
  _v3
];

if (false as boolean) {
  // @ts-expect-error — 0 is the exclusiveMinimum itself; excluded from the range
  const _v0excl: ExclusiveMinType = 0;

  void _v0excl;
}

// ---------------------------------------------------------------------------
// 3. Both bounds exclusive  →  (exclusiveMin+1) | ... | (exclusiveMax-1)
//
// exclusiveMinimum: 1, exclusiveMaximum: 5  →  inclusive [2, 4] = 2 | 3 | 4
// ---------------------------------------------------------------------------

const _BothExclusiveSchema = {
  'exclusiveMaximum': 5,
  'exclusiveMinimum': 1,
  'type': 'integer'
} as const;

void _BothExclusiveSchema;

type BothExclusiveType = InferType<typeof _BothExclusiveSchema>;

assert<AssertEqualType<BothExclusiveType, 2 | 3 | 4>>();

// ---------------------------------------------------------------------------
// 4. Inclusive equivalents produce the same result as exclusive folding
//
// minimum: 0, maximum: 4 should equal minimum: 0, exclusiveMaximum: 5
// ---------------------------------------------------------------------------

const _InclusiveEquivSchema = {
  'maximum': 4,
  'minimum': 0,
  'type': 'integer'
} as const;

void _InclusiveEquivSchema;

assert<AssertEqualType<InferType<typeof _InclusiveEquivSchema>, 0 | 1 | 2 | 3 | 4>>();
// Both reach the same literal union
assert<AssertEqualType<ExclusiveMaxType, InferType<typeof _InclusiveEquivSchema>>>();

void describe('exclusive-bound folding in integer ranges', () => {
  void it('compiles - all assertions are static', () => {
    void 0;
  });
});
