/**
 * Compile-time type assertions for `uniqueItems: true` narrowing
 * (Finding 25 / design 0002 cluster H).
 *
 * Two layered approaches verified here:
 *
 *   1. For arrays generally — the inferred type carries
 *      `UniqueArrayBrandInterface<T>` so raw `T[]` cannot satisfy it.
 *   2. For literal-typed tuples (length ≤ 8, from `prefixItems`) — the
 *      pairwise-distinctness type collapses tuples with duplicate literal
 *      elements to `never`.
 *
 * Compile-time only: this file asserts via static `as const` assignment and
 * `@ts-expect-error` markers. The runtime `validate` already enforces
 * `uniqueItems`; this PR hoists the assertion into the type system where
 * possible.
 */

import {
  describe, it
} from 'node:test';

import type {
  UniqueArrayBrandInterface,
  UniqueItemsBrandInterface
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

type AssertType<T extends true> = T;

// ---------------------------------------------------------------------------
// 1. Branded array — uniqueItems on a homogeneous array
// ---------------------------------------------------------------------------

const _UniqueStringsSchema = {
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

void _UniqueStringsSchema;

type UniqueStrings = InferType<typeof _UniqueStringsSchema>;

// Carries the parametric brand
type IsBrandedString
  = UniqueStrings extends UniqueArrayBrandInterface<string> ? true : false;
type Test1 = AssertType<IsBrandedString>;

void 0 as unknown as Test1;

// Also carries the legacy non-generic brand (back-compat)
type IsLegacyBranded
  = UniqueStrings extends UniqueItemsBrandInterface ? true : false;
type Test2 = AssertType<IsLegacyBranded>;

void 0 as unknown as Test2;

// Plain string[] is not assignable — must come through validate()/instantiate()
// @ts-expect-error — raw string[] lacks UniqueArrayBrand<string>
const _rawStrings: UniqueStrings = [
  'a',
  'b'
] as readonly string[];

void _rawStrings;

// ---------------------------------------------------------------------------
// 2. Different element types produce incompatible brands
// ---------------------------------------------------------------------------

const _UniqueNumbersSchema = {
  'items': { 'type': 'number' },
  'type': 'array',
  'uniqueItems': true
} as const;

void _UniqueNumbersSchema;

type UniqueNumbers = InferType<typeof _UniqueNumbersSchema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const numericUnique = {} as UniqueNumbers;
  // @ts-expect-error — UniqueArrayBrand<number> is not assignable to UniqueArrayBrand<string>
  const _crossAssign: UniqueStrings = numericUnique;

  void _crossAssign;
}

// ---------------------------------------------------------------------------
// 3. Literal-typed tuple narrowing — duplicate elements collapse to `never`
// ---------------------------------------------------------------------------

const _DuplicateLiteralTupleSchema = {
  'prefixItems': [
    { 'const': 'red' },
    { 'const': 'red' }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;

void _DuplicateLiteralTupleSchema;

type DupTuple = InferType<typeof _DuplicateLiteralTupleSchema>;
type DupIsNever = AssertType<[DupTuple] extends [never] ? true : false>;

void 0 as unknown as DupIsNever;

// ---------------------------------------------------------------------------
// 4. Literal-typed tuple narrowing — distinct elements survive
// ---------------------------------------------------------------------------

const _DistinctLiteralTupleSchema = {
  'prefixItems': [
    { 'const': 'red' },
    { 'const': 'green' },
    { 'const': 'blue' }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;

void _DistinctLiteralTupleSchema;

type DistinctTuple = InferType<typeof _DistinctLiteralTupleSchema>;
const _distinctOk: DistinctTuple = [
  'red',
  'green',
  'blue'
];

void _distinctOk;

// ---------------------------------------------------------------------------
// 5. uniqueItems false / absent — no brand applied
// ---------------------------------------------------------------------------

const _NotUniqueSchema = {
  'items': { 'type': 'string' },
  'type': 'array'
} as const;

void _NotUniqueSchema;

type NotUnique = InferType<typeof _NotUniqueSchema>;

// Plain readonly string[] is assignable when uniqueItems is absent
const _plainOk: NotUnique = [
  'a',
  'a',
  'a'
];

void _plainOk;

// And the type does NOT carry the unique brand
type NotBranded
  = NotUnique extends UniqueItemsBrandInterface ? false : true;
type Test5 = AssertType<NotBranded>;

void 0 as unknown as Test5;

void describe('uniqueItems narrowing (Finding 25)', () => {
  void it('compiles - all assertions are static', () => {
    void 0;
  });
});
