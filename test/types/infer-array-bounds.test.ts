/**
 * Compile-time tuple narrowing for raw `minItems` / `maxItems`.
 *
 * Mirrors the OWL `cardinality` / `minCardinality` / `maxCardinality`
 * narrowing path, but applied to plain JSON Schema arrays. Each
 * `@ts-expect-error` block proves the negative side (a value of the
 * wrong arity is rejected by the type system, not just the runtime).
 *
 * Cap behaviour: bounds at or beyond `TupleCapType = 16` fall through
 * to `ReadonlyArray<T>` so that recursion stays within TS limits.
 */

import type { InferType } from '../../src/types/Schema.js';

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

const _exactOk: ExactThree = [
  'a',
  'b',
  'c'
];

void _exactOk;

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

const _atLeastMin: AtLeastTwo = [
  1,
  2
];
const _atLeastMore: AtLeastTwo = [
  1,
  2,
  3,
  4,
  5
];

void _atLeastMin;
void _atLeastMore;

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

const _atMostEmpty: AtMostThree = [];
const _atMostOne: AtMostThree = [true];
const _atMostTwo: AtMostThree = [
  true,
  false
];
const _atMostThree: AtMostThree = [
  true,
  false,
  true
];

void _atMostEmpty;
void _atMostOne;
void _atMostTwo;
void _atMostThree;

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

const _rangeTwo: RangeTwoToFour = [
  'a',
  'b'
];
const _rangeThree: RangeTwoToFour = [
  'a',
  'b',
  'c'
];
const _rangeFour: RangeTwoToFour = [
  'a',
  'b',
  'c',
  'd'
];

void _rangeTwo;
void _rangeThree;
void _rangeFour;

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
//    ReadonlyArray<T>; recursion stays bounded.
// ---------------------------------------------------------------------------

const _BeyondCapSchema = {
  'items': { 'type': 'number' },
  'maxItems': 20,
  'minItems': 20,
  'type': 'array'
} as const;

void _BeyondCapSchema;

type BeyondCap = InferType<typeof _BeyondCapSchema>;

// Above the cap, narrowing falls through to ReadonlyArray<number>.
const _beyondShort: BeyondCap = [1];
const _beyondLong: BeyondCap = [
  1,
  2,
  3,
  4
];

void _beyondShort;
void _beyondLong;

// ---------------------------------------------------------------------------
// 6. Sanity — `items` only (no bounds) keeps the existing ReadonlyArray path.
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
//    the tuple shape is still narrowed.
// ---------------------------------------------------------------------------

const _RawExactSchema = {
  'maxItems': 2,
  'minItems': 2,
  'type': 'array'
} as const;

void _RawExactSchema;

type RawExact = InferType<typeof _RawExactSchema>;

const _rawOk: RawExact = [
  'anything',
  42
];

void _rawOk;

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
