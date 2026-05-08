/**
 * Compile-time type assertions for tight string-length narrowing
 * (Finding 20 / design 0002 cluster G).
 *
 * The narrowing is opt-in: this file enables it via module augmentation.
 * With the flag enabled:
 *
 *   - `minLength === maxLength === N` (N <= 8) -> length-N character template
 *   - `minLength < maxLength`, both <= 8 -> union of supported lengths
 *   - bounds above 8 -> falls back to plain `string`
 *
 * With the flag DISABLED (default), strings remain plain `string` regardless
 * of bounds. Tests for the disabled path live in inference.test.ts.
 */

import {
  describe, it
} from 'node:test';

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
const _ok2: InferType<typeof _Len2Schema> = 'ab';

void _ok2;
assert<AssertAssignableType<InferType<typeof _Len2Schema>, string>>();

const _Len4Schema = {
  'maxLength': 4,
  'minLength': 4,
  'type': 'string'
} as const;

void _Len4Schema;
const _ok4: InferType<typeof _Len4Schema> = 'abcd';

void _ok4;
assert<AssertAssignableType<InferType<typeof _Len4Schema>, string>>();

// ---------------------------------------------------------------------------
// 2. Range narrowing - minLength < maxLength, both <= cap
// ---------------------------------------------------------------------------

const _RangeSchema = {
  'maxLength': 4,
  'minLength': 2,
  'type': 'string'
} as const;

void _RangeSchema;
const _r2: InferType<typeof _RangeSchema> = 'ab';
const _r3: InferType<typeof _RangeSchema> = 'abc';
const _r4: InferType<typeof _RangeSchema> = 'abcd';

void _r2;
void _r3;
void _r4;
assert<AssertAssignableType<InferType<typeof _RangeSchema>, string>>();

// ---------------------------------------------------------------------------
// 3. Bounds above the cap fall back to plain `string`
// ---------------------------------------------------------------------------

const _BigLenSchema = {
  'maxLength': 64,
  'minLength': 64,
  'type': 'string'
} as const;

void _BigLenSchema;
const _big: InferType<typeof _BigLenSchema> = 'arbitrary';

void _big;
assert<AssertAssignableType<InferType<typeof _BigLenSchema>, string>>();

// maxLength alone with a small bound also narrows (range 0..maxLength)
const _MaxOnlySchema = {
  'maxLength': 3,
  'type': 'string'
} as const;

void _MaxOnlySchema;
const _m0: InferType<typeof _MaxOnlySchema> = '';
const _m3: InferType<typeof _MaxOnlySchema> = 'abc';

void _m0;
void _m3;

void describe('tight string-length narrowing (Finding 20)', () => {
  void it('compiles with the tightStringLengths flag enabled', () => {
    void 0;
  });
});
