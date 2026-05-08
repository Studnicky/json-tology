/**
 * Compile-time type assertions for patternProperties template-literal
 * expansion (Finding 19 / design 0002 cluster G).
 *
 * Validates that anchored regex shapes in `patternProperties` map to the
 * expected key type:
 *
 *   - `^prefix`      -> `${prefix}${string}`        (existing)
 *   - `suffix$`      -> `${string}${suffix}`        (existing)
 *   - `^exact$`      -> literal `'exact'`            (existing)
 *   - `^(a|b|c)$`    -> `'a' | 'b' | 'c'`            (Finding 19)
 *   - `^[a-z]+_id$`  -> `${string}_id`               (Finding 19)
 *   - `^.{N}$`       -> length-N template literal     (Finding 19)
 *
 * Patterns no handler recognises continue to fall through to `string`.
 */

import {
  describe, it
} from 'node:test';

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
// 1. Alternation - `^(a|b|c)$`
// ---------------------------------------------------------------------------

const _AlternationSchema = {
  'patternProperties': { '^(red|green|blue)$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _AlternationSchema;
assert<AssertEqualType<keyof InferType<typeof _AlternationSchema> & string, 'blue' | 'green' | 'red'>>();

const _SingletonSchema = {
  'patternProperties': { '^(only)$': { 'type': 'number' } },
  'type': 'object'
} as const;

void _SingletonSchema;
assert<AssertEqualType<keyof InferType<typeof _SingletonSchema> & string, 'only'>>();

// ---------------------------------------------------------------------------
// 2. Character class + literal suffix - `^[a-z]+_id$`
// ---------------------------------------------------------------------------

const _CharClassSchema = {
  'patternProperties': { '^[a-z]+_id$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _CharClassSchema;
// Char class narrows to `string` (TS cannot bind to a-z); suffix `_id`
// survives.
assert<AssertEqualType<keyof InferType<typeof _CharClassSchema> & string, `${string}_id`>>();

const _StarClassSchema = {
  'patternProperties': { '^[A-Z]*KEY$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _StarClassSchema;
assert<AssertEqualType<keyof InferType<typeof _StarClassSchema> & string, `${string}KEY`>>();

// ---------------------------------------------------------------------------
// 3. Exact-length `.{N}` for small N
// ---------------------------------------------------------------------------

const _DotLenSchema = {
  'patternProperties': { '^.{3}$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _DotLenSchema;
// length-3 -> 3 string segments concatenated. TS collapses
// `${string}${string}${string}` to plain `string`, so the key set still
// admits length-3 inputs but reduces structurally to `string`.
const _len3: keyof InferType<typeof _DotLenSchema> = 'abc';

void _len3;

// length above the cap (8) collapses to `string`
const _DotLenBigSchema = {
  'patternProperties': { '^.{20}$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _DotLenBigSchema;
assert<AssertEqualType<keyof InferType<typeof _DotLenBigSchema>, string>>();

// ---------------------------------------------------------------------------
// 4. No regression - existing handlers still fire
// ---------------------------------------------------------------------------

const _PrefixSchema = {
  'patternProperties': { '^x_': { 'type': 'number' } },
  'type': 'object'
} as const;

void _PrefixSchema;
assert<AssertEqualType<keyof InferType<typeof _PrefixSchema> & string, `x_${string}`>>();

const _SuffixSchema = {
  'patternProperties': { '_at$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _SuffixSchema;
assert<AssertEqualType<keyof InferType<typeof _SuffixSchema> & string, `${string}_at`>>();

const _ExactSchema = {
  'patternProperties': { '^exactly$': { 'type': 'boolean' } },
  'type': 'object'
} as const;

void _ExactSchema;
assert<AssertEqualType<keyof InferType<typeof _ExactSchema> & string, 'exactly'>>();

// ---------------------------------------------------------------------------
// 5. Unsupported patterns - must continue to fall through to `string`
// ---------------------------------------------------------------------------

const _UnanchoredAltSchema = {
  'patternProperties': { 'foo|bar': { 'type': 'string' } },
  'type': 'object'
} as const;

void _UnanchoredAltSchema;
assert<AssertEqualType<keyof InferType<typeof _UnanchoredAltSchema>, string>>();

const _LookaheadSchema = {
  'patternProperties': { '^(?=foo)bar$': { 'type': 'string' } },
  'type': 'object'
} as const;

void _LookaheadSchema;
assert<AssertEqualType<keyof InferType<typeof _LookaheadSchema>, string>>();

// Smoke runtime hook so the file is recognised by the runner.
void describe('patternProperties compile-time inference (Finding 19)', () => {
  void it('compiles - every assertion in this file is a static check', () => {
    void 0;
  });
});
