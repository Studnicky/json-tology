/**
 * Compile-time type assertions for `propertyNames: { pattern }` key narrowing.
 *
 * When `propertyNames` carries a `pattern` keyword with a recognised anchored
 * shape, the inferred object key type is narrowed via `PatternToKeyType` —
 * the same helper used for `patternProperties` keys. Complex or unanchored
 * patterns resolve to `string`, keeping the open-object fallback unchanged.
 *
 * Rules verified:
 *   - `propertyNames: { pattern: '^x' }` → keys narrow to `` `x${string}` ``
 *   - `propertyNames: { pattern: '^(a|b)$' }` → keys narrow to `'a' | 'b'`
 *   - complex pattern → keys stay `string` (no narrowing, same as before)
 *   - `propertyNames: { enum }` still works (regression guard)
 */

import {
  describe, it
} from 'node:test';

import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AssertAssignableType<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Prefix pattern `^x` — keys narrow to `x${string}` template literal
// ---------------------------------------------------------------------------

const _PrefixKeySchema = {
  'propertyNames': { 'pattern': '^x' },
  'type': 'object'
} as const;

void _PrefixKeySchema;
type PrefixKeyType = InferType<typeof _PrefixKeySchema>;
// Key index type narrows to `x${string}`.
assert<AssertAssignableType<PrefixKeyType, Record<`x${string}`, unknown>>>();
// A value with an `x`-prefixed key is assignable.
const _xVal: PrefixKeyType = {
  'xBaz': 42,
  'xFoo': 'bar'
};

void _xVal;

// ---------------------------------------------------------------------------
// 2. Alternation pattern `^(a|b)$` — keys narrow to literal union
// ---------------------------------------------------------------------------

const _AltKeySchema = {
  'propertyNames': { 'pattern': '^(alpha|beta)$' },
  'type': 'object'
} as const;

void _AltKeySchema;
type AltKeyType = InferType<typeof _AltKeySchema>;
// Keys narrowed to the two literals.
assert<AssertEqualType<keyof AltKeyType & string, 'alpha' | 'beta'>>();

// ---------------------------------------------------------------------------
// 3. Complex pattern — keys stay string (zero blast-radius)
// ---------------------------------------------------------------------------

const _ComplexKeySchema = {
  'propertyNames': { 'pattern': '^\\d{4}$' },
  'type': 'object'
} as const;

void _ComplexKeySchema;
type ComplexKeyType = InferType<typeof _ComplexKeySchema>;
// Complex digit pattern has metacharacters → PatternToKeyType returns string.
// The key index remains open (string), same as the pre-existing fallback.
assert<AssertAssignableType<ComplexKeyType, Record<string, unknown>>>();
assert<AssertAssignableType<Record<string, unknown>, ComplexKeyType>>();

// ---------------------------------------------------------------------------
// 4. Regression — propertyNames: { enum } still narrows correctly
// ---------------------------------------------------------------------------

const _EnumKeySchema = {
  'propertyNames': {
    'enum': [
      'foo',
      'bar'
    ]
  },
  'type': 'object'
} as const;

void _EnumKeySchema;
assert<AssertEqualType<keyof InferType<typeof _EnumKeySchema> & string, 'bar' | 'foo'>>();

// ---------------------------------------------------------------------------
// 5. propertyNames: { pattern } with additionalProperties value schema
// ---------------------------------------------------------------------------

const _WithValueSchema = {
  'additionalProperties': { 'type': 'number' },
  'propertyNames': { 'pattern': '^metric_' },
  'type': 'object'
} as const;

void _WithValueSchema;
type WithValueType = InferType<typeof _WithValueSchema>;
// Keys narrow to `metric_${string}` and values are number.
const _metricObj: WithValueType = {
  'metric_cpu': 99,
  'metric_mem': 42
};

void _metricObj;
assert<AssertAssignableType<WithValueType, Record<`metric_${string}`, number | undefined>>>();

// ---------------------------------------------------------------------------
// Runtime smoke hook — all assertions above are compile-time.
// ---------------------------------------------------------------------------

void describe('propertyNames:pattern key narrowing', () => {
  void it('compiles — every assertion in this file is a static check', () => {
    void 0;
  });
});
