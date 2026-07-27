/**
 * Compile-time type assertions for `minContains` / `maxContains` phantom brands.
 *
 * Verifies that a schema declaring `contains`, `minContains`, and `maxContains`
 * produces an inferred type that carries both `MinimumContainsBrandType<N>` and
 * `MaximumContainsBrandType<N>`, and that different count literals produce
 * incompatible brands.
 */

import {
  describe, it
} from 'node:test';

import type {
  MaximumContainsBrandType,
  MinimumContainsBrandType
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

type AssertAssignableType<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Schema with contains + minContains + maxContains carries both brands
// ---------------------------------------------------------------------------

const _ContainsSchema = {
  'contains': { 'type': 'string' },
  'maxContains': 5,
  'minContains': 2,
  'type': 'array'
} as const;

void _ContainsSchema;

type ContainsArr = InferType<typeof _ContainsSchema>;

// Carries MinimumContainsBrandType<2>
assert<AssertAssignableType<ContainsArr, MinimumContainsBrandType<2>>>();

// Carries MaximumContainsBrandType<5>
assert<AssertAssignableType<ContainsArr, MaximumContainsBrandType<5>>>();

// Carries both simultaneously
assert<AssertAssignableType<ContainsArr, MaximumContainsBrandType<5> & MinimumContainsBrandType<2>>>();

// ---------------------------------------------------------------------------
// 2. minContains literal is distinct — MinimumContainsBrandType<2> ≠ MinimumContainsBrandType<3>
// ---------------------------------------------------------------------------

const _Contains3Schema = {
  'contains': { 'type': 'string' },
  'minContains': 3,
  'type': 'array'
} as const;

void _Contains3Schema;

type ContainsMin3 = InferType<typeof _Contains3Schema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- branded phantom
  const brandedMin3 = {} as ContainsMin3;
  // @ts-expect-error — MinimumContainsBrandType<3> is not assignable to MinimumContainsBrandType<2>
  const _mismatch: ContainsArr = brandedMin3;

  void _mismatch;
}

// ---------------------------------------------------------------------------
// 3. maxContains literal is distinct — MaximumContainsBrandType<5> ≠ MaximumContainsBrandType<10>
// ---------------------------------------------------------------------------

const _ContainsMax10Schema = {
  'contains': { 'type': 'string' },
  'maxContains': 10,
  'type': 'array'
} as const;

void _ContainsMax10Schema;

type ContainsMax10 = InferType<typeof _ContainsMax10Schema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- branded phantom
  const brandedMax10 = {} as ContainsMax10;
  // @ts-expect-error — MaximumContainsBrandType<10> is not assignable to MaximumContainsBrandType<5>
  const _mismatch2: ContainsArr = brandedMax10;

  void _mismatch2;
}

// ---------------------------------------------------------------------------
// 4. Schema without minContains / maxContains does not carry the brands
// ---------------------------------------------------------------------------

const _NoBoundsSchema = {
  'contains': { 'type': 'string' },
  'type': 'array'
} as const;

void _NoBoundsSchema;

type NoBoundsArr = InferType<typeof _NoBoundsSchema>;

// NoBoundsArr is not assignable to MinimumContainsBrandType<2> — no brand was applied
assert<AssertAssignableType<NoBoundsArr, MinimumContainsBrandType<2>> extends true ? false : true>();

// NoBoundsArr is not assignable to MaximumContainsBrandType<5>
assert<AssertAssignableType<NoBoundsArr, MaximumContainsBrandType<5>> extends true ? false : true>();

void describe('minContains / maxContains brands', () => {
  void it('compiles - all assertions are static', () => {
    void 0;
  });
});
