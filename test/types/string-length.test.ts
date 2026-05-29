/**
 * Compile-time type assertions for tight string-length narrowing
 * (Finding 20 / design 0002 cluster G).
 *
 * Tight string-length narrowing is enabled by default. With it on, a
 * length-bounded string schema infers to the relevant `minLength` / `maxLength`
 * constraint brands intersected with a length-shaped string:
 *
 *   - `minLength === maxLength === N` (N <= 8) -> length-N character template
 *   - `minLength < maxLength`, both <= 8 -> union of supported lengths
 *   - bounds above 8 -> falls back to plain `string`
 *
 * Because the constraint brands carry phantom keys, a plain string literal is
 * not directly assignable to the inferred type — only runtime-coerced values
 * carry the brands. The contract is therefore asserted at the type level:
 * every length-bounded string is assignable to `string` AND carries its
 * length brands.
 */

import {
  describe, it
} from 'node:test';

import type {
  MaxLengthBrandInterface, MinLengthBrandInterface
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

declare module '../../src/types/TypeConfig.js' {
  interface JsonTologyTypeConfigInterface { 'tightStringLengths': true }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AssertAssignableType<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Exact-length string narrowing
// ---------------------------------------------------------------------------

const _Len2Schema = {
  'maxLength': 2,
  'minLength': 2,
  'type': 'string'
} as const;

void _Len2Schema;
// Exact length 2: carries both length brands and remains assignable to string.
assert<AssertAssignableType<InferType<typeof _Len2Schema>, string>>();
assert<AssertAssignableType<
  InferType<typeof _Len2Schema>,
  MaxLengthBrandInterface<2> & MinLengthBrandInterface<2>
>>();

const _Len4Schema = {
  'maxLength': 4,
  'minLength': 4,
  'type': 'string'
} as const;

void _Len4Schema;
// Exact length 4: carries both length brands and remains assignable to string.
assert<AssertAssignableType<InferType<typeof _Len4Schema>, string>>();
assert<AssertAssignableType<
  InferType<typeof _Len4Schema>,
  MaxLengthBrandInterface<4> & MinLengthBrandInterface<4>
>>();

// ---------------------------------------------------------------------------
// 2. Range narrowing - minLength < maxLength, both <= cap
// ---------------------------------------------------------------------------

const _RangeSchema = {
  'maxLength': 4,
  'minLength': 2,
  'type': 'string'
} as const;

void _RangeSchema;
// Range 2..4: carries both length brands and remains assignable to string.
assert<AssertAssignableType<InferType<typeof _RangeSchema>, string>>();
assert<AssertAssignableType<
  InferType<typeof _RangeSchema>,
  MaxLengthBrandInterface<4> & MinLengthBrandInterface<2>
>>();

// ---------------------------------------------------------------------------
// 3. Bounds above the cap fall back to a plain `string` shape — but the
//    length brands are still applied (brands are independent of the tight
//    template-narrowing cap).
// ---------------------------------------------------------------------------

const _BigLenSchema = {
  'maxLength': 64,
  'minLength': 64,
  'type': 'string'
} as const;

void _BigLenSchema;
assert<AssertAssignableType<InferType<typeof _BigLenSchema>, string>>();
assert<AssertAssignableType<
  InferType<typeof _BigLenSchema>,
  MaxLengthBrandInterface<64> & MinLengthBrandInterface<64>
>>();

// maxLength alone with a small bound also narrows (range 0..maxLength) and
// carries the maxLength brand.
const _MaxOnlySchema = {
  'maxLength': 3,
  'type': 'string'
} as const;

void _MaxOnlySchema;
assert<AssertAssignableType<InferType<typeof _MaxOnlySchema>, string>>();
assert<AssertAssignableType<InferType<typeof _MaxOnlySchema>, MaxLengthBrandInterface<3>>>();

void describe('tight string-length narrowing (Finding 20)', () => {
  void it('compiles with the tightStringLengths flag enabled', () => {
    void 0;
  });
});
