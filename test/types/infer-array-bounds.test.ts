/**
 * Compile-time tuple narrowing for raw `minItems` / `maxItems`.
 *
 * Mirrors the OWL `cardinality` / `minCardinality` / `maxCardinality`
 * narrowing path, but applied to plain JSON Schema arrays.
 *
 * The inferred type is the narrowed tuple shape intersected with the
 * `maxItems` / `minItems` constraint brands. Because the brands carry phantom
 * keys, a plain array literal is not directly assignable to the inferred type —
 * only runtime-coerced values carry them. The positive contract is therefore
 * asserted at the type level (exact branded-type equality), and the negative
 * side (a value of the wrong arity) is proved with `@ts-expect-error`.
 *
 * Cap behaviour: bounds at or beyond `TupleCapType = 16` fall through to
 * `T[]` so that recursion stays within TS limits — the brands are
 * still applied.
 */

import type {
  MaxItemsBrandType, MinItemsBrandType
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  // interop: void 0 as unknown as T is the compile-time type-test idiom; no
  // typed path exists from void to an arbitrary constraint-bounded type T.
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Exact length — minItems === maxItems → BuildExactTupleType
// ---------------------------------------------------------------------------

const _ExactThreeSchema = {
  'items': { 'type': 'string' },
  'maxItems': 3,
  'minItems': 3,
  'type': 'array'
} as const;

void _ExactThreeSchema;

type ExactThree = InferType<typeof _ExactThreeSchema>;

// Exactly three strings, carrying both item-count brands.
assert<AssertEqualType<
  ExactThree,
  [string, string, string] & MaxItemsBrandType<3> & MinItemsBrandType<3>
>>();

// @ts-expect-error — length 2 is rejected, must be exactly 3
const _exactShort: ExactThree = [
  'a',
  'b'
];

void _exactShort;

// @ts-expect-error — length 4 is rejected, must be exactly 3
const _exactLong: ExactThree = [
  'a',
  'b',
  'c',
  'd'
];

void _exactLong;

// ---------------------------------------------------------------------------
// 2. Min only — minItems > 0, no maxItems → BuildAtLeastTupleType
// ---------------------------------------------------------------------------

const _AtLeastTwoSchema = {
  'items': { 'type': 'number' },
  'minItems': 2,
  'type': 'array'
} as const;

void _AtLeastTwoSchema;

type AtLeastTwo = InferType<typeof _AtLeastTwoSchema>;

// At least two numbers (non-empty prefix + variadic tail), carrying the minItems brand.
assert<AssertEqualType<
  AtLeastTwo,
  [number, number, ...number[]] & MinItemsBrandType<2>
>>();

// @ts-expect-error — length 1 is rejected, requires at least 2
const _atLeastShort: AtLeastTwo = [1];

void _atLeastShort;

// @ts-expect-error — empty is rejected, requires at least 2
const _atLeastEmpty: AtLeastTwo = [];

void _atLeastEmpty;

// ---------------------------------------------------------------------------
// 3. Max only — maxItems, no minItems → BuildAtMostTupleType (union 0..N)
// ---------------------------------------------------------------------------

const _AtMostThreeSchema = {
  'items': { 'type': 'boolean' },
  'maxItems': 3,
  'type': 'array'
} as const;

void _AtMostThreeSchema;

type AtMostThree = InferType<typeof _AtMostThreeSchema>;

// Union of boolean tuples length 0..3, carrying the maxItems brand.
assert<AssertEqualType<
  AtMostThree,
  (
    | []
    | [boolean, boolean, boolean]
    | [boolean, boolean]
    | [boolean]
  ) & MaxItemsBrandType<3>
>>();

// @ts-expect-error — length 4 is rejected, must be at most 3
const _atMostLong: AtMostThree = [
  true,
  false,
  true,
  false
];

void _atMostLong;

// ---------------------------------------------------------------------------
// 4. Bounded range — minItems < maxItems → union of tuples length min..max
// ---------------------------------------------------------------------------

const _RangeTwoToFourSchema = {
  'items': { 'type': 'string' },
  'maxItems': 4,
  'minItems': 2,
  'type': 'array'
} as const;

void _RangeTwoToFourSchema;

type RangeTwoToFour = InferType<typeof _RangeTwoToFourSchema>;

// Bounded union of string tuples across the 2..4 range, carrying both brands.
assert<AssertEqualType<
  RangeTwoToFour,
  (
    | [string, string, string, string]
    | [string, string]
  ) & MaxItemsBrandType<4> & MinItemsBrandType<2>
>>();

// @ts-expect-error — length 1 is below minItems
const _rangeShort: RangeTwoToFour = ['a'];

void _rangeShort;

// @ts-expect-error — length 5 is above maxItems
const _rangeLong: RangeTwoToFour = [
  'a',
  'b',
  'c',
  'd',
  'e'
];

void _rangeLong;

// ---------------------------------------------------------------------------
// 5. Beyond cap — bounds at or beyond TupleCapType = 16 fall through to
//    T[]; the brands are still applied.
// ---------------------------------------------------------------------------

const _BeyondCapSchema = {
  'items': { 'type': 'number' },
  'maxItems': 20,
  'minItems': 20,
  'type': 'array'
} as const;

void _BeyondCapSchema;

type BeyondCap = InferType<typeof _BeyondCapSchema>;

// Above the cap, narrowing falls through to number[] + both brands.
assert<AssertEqualType<
  BeyondCap,
  MaxItemsBrandType<20> & MinItemsBrandType<20> & number[]
>>();

// ---------------------------------------------------------------------------
// 6. Sanity — `items` only (no bounds) keeps the existing array-of-T path
//    with no item-count brands.
// ---------------------------------------------------------------------------

const _UnboundedSchema = {
  'items': { 'type': 'string' },
  'type': 'array'
} as const;

void _UnboundedSchema;

type Unbounded = InferType<typeof _UnboundedSchema>;

const _unboundedEmpty: Unbounded = [];
const _unboundedOne: Unbounded = ['x'];
const _unboundedMany: Unbounded = [
  'x',
  'y',
  'z',
  'w',
  'v'
];

void _unboundedEmpty;
void _unboundedOne;
void _unboundedMany;

// ---------------------------------------------------------------------------
// 7. Raw bounds without `items` — element type defaults to `unknown` but
//    the tuple shape is still narrowed and the brands are applied.
// ---------------------------------------------------------------------------

const _RawExactSchema = {
  'maxItems': 2,
  'minItems': 2,
  'type': 'array'
} as const;

void _RawExactSchema;

type RawExact = InferType<typeof _RawExactSchema>;

// Exactly two unknown elements, carrying both item-count brands.
assert<AssertEqualType<
  RawExact,
  [unknown, unknown] & MaxItemsBrandType<2> & MinItemsBrandType<2>
>>();

// @ts-expect-error — length 1 is rejected, must be exactly 2
const _rawShort: RawExact = ['only-one'];

void _rawShort;

// @ts-expect-error — length 3 is rejected, must be exactly 2
const _rawLong: RawExact = [
  1,
  2,
  3
];

void _rawLong;
