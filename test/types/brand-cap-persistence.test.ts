/**
 * Compile-time assertions confirming that constraint brands persist above the
 * tight-narrowing caps.
 *
 * The `_INTEGER_RANGE_CAP` is 50 and `_STRING_LENGTH_CAP` is 8. Above those
 * caps the tight narrowing (literal union / template literal) bails out and
 * widens to `number` / `string`. The brand intersections, however, are
 * independent of the caps and must remain on the inferred type regardless.
 *
 * This file documents and locks that separation: brands are always present
 * even when the tight-narrowing feature cannot enumerate a finite literal type.
 */

import {
  describe, it
} from 'node:test';

import type {
  MaxItemsBrandType,
  MaxLengthBrandType,
  MinItemsBrandType,
  MinLengthBrandType
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

type AssertAssignableType<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Array brands persist above _INTEGER_RANGE_CAP (50)
//
// minItems: 20 is well below the integer-range cap, but the TUPLE cap
// (_INTEGER_RANGE_CAP = 50 items) gates NarrowArrayByItemsBoundsType.
// Even if tuple narrowing bails out and the array element type widens,
// MinItemsBrandType<20> must still be intersected on the result.
// ---------------------------------------------------------------------------

const _MinItems20Schema = {
  'items': { 'type': 'string' },
  'minItems': 20,
  'type': 'array'
} as const;

void _MinItems20Schema;

type MinItems20Arr = InferType<typeof _MinItems20Schema>;

// The brand is present regardless of whether tuple narrowing fires
assert<AssertAssignableType<MinItems20Arr, MinItemsBrandType<20>>>();

// Above-cap with maxItems — MaxItemsBrandType still present
const _MaxItems60Schema = {
  'items': { 'type': 'string' },
  'maxItems': 60,
  'type': 'array'
} as const;

void _MaxItems60Schema;

type MaxItems60Arr = InferType<typeof _MaxItems60Schema>;

assert<AssertAssignableType<MaxItems60Arr, MaxItemsBrandType<60>>>();

// ---------------------------------------------------------------------------
// 2. String brands persist above _STRING_LENGTH_CAP (8)
//
// The tight template-literal narrowing caps at 8 characters. Above it the
// inferred type widens to `string`. But MinLengthBrandType and
// MaxLengthBrandType must still be intersected.
// ---------------------------------------------------------------------------

const _MinLen50Schema = {
  'minLength': 50,
  'type': 'string'
} as const;

void _MinLen50Schema;

type MinLen50 = InferType<typeof _MinLen50Schema>;

// Assignable to string (brand + primitive intersection)
assert<AssertAssignableType<MinLen50, string>>();

// Brand is still present above the string-length cap
assert<AssertAssignableType<MinLen50, MinLengthBrandType<50>>>();

const _MaxLen100Schema = {
  'maxLength': 100,
  'type': 'string'
} as const;

void _MaxLen100Schema;

type MaxLen100 = InferType<typeof _MaxLen100Schema>;

// Assignable to string
assert<AssertAssignableType<MaxLen100, string>>();

// Brand persists above the cap
assert<AssertAssignableType<MaxLen100, MaxLengthBrandType<100>>>();

// Both length brands when both keywords present above the cap
const _BothLenAboveCapSchema = {
  'maxLength': 64,
  'minLength': 32,
  'type': 'string'
} as const;

void _BothLenAboveCapSchema;

type BothLenAboveCap = InferType<typeof _BothLenAboveCapSchema>;

assert<AssertAssignableType<BothLenAboveCap, string>>();
assert<AssertAssignableType<BothLenAboveCap, MaxLengthBrandType<64> & MinLengthBrandType<32>>>();

void describe('brand persistence above tight-narrowing caps', () => {
  void it('compiles - all assertions are static', () => {
    void 0;
  });
});
