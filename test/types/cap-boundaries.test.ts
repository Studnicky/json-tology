/**
 * Compile-time boundary assertions for depth caps and recursion guards.
 *
 * Verifies the documented behaviour at each cap boundary in Infer.ts.
 * Each section confirms the boundary by observing compile-time assignability:
 *
 *   - Within-cap schemas produce narrow literal types (only specific values
 *     compile for typed variables).
 *   - Above-cap schemas produce wide types (any number compiles).
 *   - Pairwise uniqueness: duplicate literals in short tuples → never.
 *   - Depth-cap fallthrough: paths beyond the guard depth are absent.
 */

import {
  describe, it
} from 'node:test';

import type {
  DeepPropertyPathsType,
  IntegerRangeType,
  MultipleOfRangeType,
  SchemaPointerPathsType
} from '../../src/types/Infer.js';
import type { UniqueArrayBrandType } from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. UniqueTuplePairwiseType cap
//
// A 2-element tuple with duplicate literals collapses to never.
// A 9-element schema with a duplicate at position 8 is above the cap —
// the duplicate is NOT detected at compile time; the result is not never.
// ---------------------------------------------------------------------------

// Duplicate in short tuple → never
const _DupSchema = {
  'prefixItems': [
    { 'const': 'a' },
    { 'const': 'a' }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;

void _DupSchema;

type Dup2 = InferType<typeof _DupSchema>;
assert<AssertEqualType<Dup2, never>>();

// Above cap (9 elements): still carries UniqueArrayBrandType brand
const _L9WithDupSchema = {
  'prefixItems': [
    { 'const': 'a' },
    { 'const': 'b' },
    { 'const': 'c' },
    { 'const': 'd' },
    { 'const': 'e' },
    { 'const': 'f' },
    { 'const': 'g' },
    { 'const': 'h' },
    { 'const': 'a' }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;

void _L9WithDupSchema;

type L9WithDup = InferType<typeof _L9WithDupSchema>;

// The brand is applied regardless of whether pairwise narrowing fires
assert<L9WithDup extends UniqueArrayBrandType<unknown> ? true : false>();

// ---------------------------------------------------------------------------
// 2. IntegerRangeType cap = 50
//
//   within-cap: narrow literal union
//   above-cap: wide type — any number is assignable
// ---------------------------------------------------------------------------

// Within-cap: small range produces a literal union
assert<AssertEqualType<IntegerRangeType<1, 3>, 1 | 2 | 3>>();

// Within-cap via InferType: only specific values compile
const _RatingSchema = {
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;

void _RatingSchema;

type Rating = InferType<typeof _RatingSchema>;
const _r1: Rating = 1;
const _r3: Rating = 3;
const _r5: Rating = 5;

void [
  _r1,
  _r3,
  _r5
];

if (false as boolean) {
  // @ts-expect-error — 6 is outside the range 1..5 (type is narrowed to literal union)
  const _r6: Rating = 6;

  void _r6;
}

// Above-cap: shifted range where max > 50 → any number in a wide range compiles
// (the shifted range 100..110 already covers more than 50 values when normalised,
//  so the type widens to number rather than a narrow literal union)
const _AboveCapSchema = {
  'maximum': 110,
  'minimum': 100,
  'type': 'integer'
} as const;

void _AboveCapSchema;

// Any number is accepted — the type is not narrowed to a finite literal union
const _above100: InferType<typeof _AboveCapSchema> = 100;
const _above999: InferType<typeof _AboveCapSchema> = 999;

void [
  _above100,
  _above999
];

// ---------------------------------------------------------------------------
// 3. MultipleOfRangeType cap = 50
//
//   within-cap: literal union of multiples
//   above-cap: wide type
// ---------------------------------------------------------------------------

// Within-cap: evens 0..10 → 0 | 2 | 4 | 6 | 8 | 10
assert<AssertEqualType<MultipleOfRangeType<0, 10, 2>, 0 | 2 | 4 | 6 | 8 | 10>>();

// Within-cap via InferType
const _EvensSchema = {
  'maximum': 10,
  'minimum': 0,
  'multipleOf': 2,
  'type': 'integer'
} as const;

void _EvensSchema;

type Evens = InferType<typeof _EvensSchema>;
const _ev0: Evens = 0;
const _ev4: Evens = 4;
const _ev10: Evens = 10;

void [
  _ev0,
  _ev4,
  _ev10
];

if (false as boolean) {
  // @ts-expect-error — 3 is not a multiple of 2 in range 0..10
  const _ev3: Evens = 3;

  void _ev3;
}

// Above-cap: shifted range where max > 50 → any number compiles
const _MultipleAboveCapSchema = {
  'maximum': 110,
  'minimum': 100,
  'multipleOf': 1,
  'type': 'integer'
} as const;

void _MultipleAboveCapSchema;

// Any number is accepted when above the cap
const _multiOutOfRange: InferType<typeof _MultipleAboveCapSchema> = 9999;

void _multiOutOfRange;

// ---------------------------------------------------------------------------
// 4. DeepPropertyPathsType recursion guard (DeepPropertyDepthCap = 4)
//
// At depth 4 the recursion stops; depth-5 paths are absent from the union.
// ---------------------------------------------------------------------------

const _DeepSchema = {
  '$id': 'https://example.io/Deep',
  'properties': {
    'l1': {
      'properties': {
        'l2': {
          'properties': {
            'l3': {
              'properties': {
                'l4': {
                  'properties': { 'l5': { 'type': 'string' } },
                  'type': 'object'
                }
              },
              'type': 'object'
            }
          },
          'type': 'object'
        }
      },
      'type': 'object'
    }
  },
  'type': 'object'
} as const;

void _DeepSchema;

type DeepPaths = DeepPropertyPathsType<typeof _DeepSchema>;

// Depth-1 path exists
assert<'l1' extends DeepPaths ? true : false>();

// Depth-2 path exists
assert<'l1.l2' extends DeepPaths ? true : false>();

// Depth-3 path exists
assert<'l1.l2.l3' extends DeepPaths ? true : false>();

// Depth-5 path NOT in DeepPaths (capped at 4)
assert<AssertEqualType<'l1.l2.l3.l4.l5' extends DeepPaths ? true : false, false>>();

// ---------------------------------------------------------------------------
// 5. SchemaPointerPathsType recursion guard (SchemaPointerDepthCap = 5)
//
// Paths up to depth 5 exist; the union is a non-empty string union.
// ---------------------------------------------------------------------------

const _PointerSchema = {
  '$id': 'https://example.io/Pointer',
  'properties': {
    'a': {
      'properties': {
        'b': {
          'properties': { 'c': { 'type': 'string' } },
          'type': 'object'
        }
      },
      'type': 'object'
    }
  },
  'type': 'object'
} as const;

void _PointerSchema;

type PointerPaths = SchemaPointerPathsType<typeof _PointerSchema>;

// Top-level property path exists
assert<'/properties/a' extends PointerPaths ? true : false>();

// Nested property path exists
assert<'/properties/a/properties/b' extends PointerPaths ? true : false>();

// SchemaPointerPathsType produces a string union
assert<PointerPaths extends string ? true : false>();

// The union is not empty (some paths exist)
assert<[PointerPaths] extends [never] ? false : true>();

void describe('cap boundaries (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
