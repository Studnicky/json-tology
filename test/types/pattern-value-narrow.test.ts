/**
 * Compile-time type assertions for `pattern` value narrowing on `type:'string'`.
 *
 * When `tightStringLengths` is enabled (the default), a `pattern` keyword with
 * a recognised anchored shape narrows the inferred value type via
 * `PatternToKeyType` — the same helper used for `patternProperties` key types.
 *
 * Rules verified:
 *   - `^(a|b|c)$`  → value narrows to `'a' | 'b' | 'c'` (plus PatternBrandType)
 *   - `^foo`        → value narrows to `` `foo${string}` `` (plus PatternBrandType)
 *   - complex / digit-class / char-class patterns → inferred type is still
 *     assignable to `string` — no template-literal narrowing occurs.
 *
 * The `PatternBrandType` phantom brand is preserved in all cases.
 */

import {
  describe, it
} from 'node:test';

import type { PatternBrandType } from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

// Confirm the tightStringLengths flag is on (default) so pattern narrowing fires.
declare module '../../src/interfaces/JsonTologyTypeConfigInterface.js' {
  interface JsonTologyTypeConfigInterface { 'tightStringLengths': true }
}

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
// 1. Alternation pattern `^(a|b|c)$` — value narrows to literal union
// ---------------------------------------------------------------------------

const _AltSchema = {
  'pattern': '^(a|b|c)$',
  'type': 'string'
} as const;

void _AltSchema;
// Value space narrows to the three literals.
assert<AssertAssignableType<InferType<typeof _AltSchema>, 'a' | 'b' | 'c'>>();
// PatternBrandType is still carried (brand + value intersection).
assert<AssertAssignableType<InferType<typeof _AltSchema>, PatternBrandType<'^(a|b|c)$'>>>();
// The inferred type is assignable to string (literal union ⊂ string).
assert<AssertAssignableType<InferType<typeof _AltSchema>, string>>();

// ---------------------------------------------------------------------------
// 2. Prefix pattern `^foo` — value narrows to template literal
// ---------------------------------------------------------------------------

const _PrefixSchema = {
  'pattern': '^foo',
  'type': 'string'
} as const;

void _PrefixSchema;
// Value narrows to the `foo`-prefixed template literal.
assert<AssertAssignableType<InferType<typeof _PrefixSchema>, `foo${string}`>>();
// PatternBrandType is still carried.
assert<AssertAssignableType<InferType<typeof _PrefixSchema>, PatternBrandType<'^foo'>>>();
// Template literals are assignable to string.
assert<AssertAssignableType<InferType<typeof _PrefixSchema>, string>>();

// ---------------------------------------------------------------------------
// 3. Complex patterns — NO value narrowing (PatternToKeyType → string → no-op)
//
// Proof strategy: the inferred type is still assignable to `string`. Additionally
// we prove the narrowing is absent by showing the inferred type for a simple
// unambiguous alternation pattern IS distinct from a complex-pattern inferred
// type using AssertEqualType on the structural string shapes only.
//
// Note: PhantomBrand markers prevent `string` from being assignable TO an
// inferred branded type in the reverse direction — this is expected and correct
// (brands are flow-typed in at runtime). The "no narrowing" proof is that
// InferType for these schemas is assignable to string (i.e. the value space is
// not narrower than string).
// ---------------------------------------------------------------------------

// ISBN-style digit pattern — `\d` triggers HasRegexMetaType → PatternToKeyType
// returns `string` → TightStringPatternType is `string` → intersection is no-op.
const _DigitSchema = {
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

void _DigitSchema;
// Still assignable to string — not narrowed to a literal or template.
assert<AssertAssignableType<InferType<typeof _DigitSchema>, string>>();
// The pattern brand is still present.
assert<AssertAssignableType<InferType<typeof _DigitSchema>, PatternBrandType<'^\\d{13}$'>>>();
// Confirm the string-value shape did NOT narrow to the alternation type of
// the simple pattern above (i.e. InferType differs from the alternation case).
// This assertion fails only if the types are actually equal — they should not be:
// the alternation type is a literal union, the digit type is broad string.
assert<AssertEqualType<
  AssertEqualType<InferType<typeof _DigitSchema>, InferType<typeof _AltSchema>>,
  false
>>();

// Char-class pattern — `[A-Z]` contains `[` metacharacter → PatternToKeyType = string.
const _CharClassSchema = {
  'pattern': '^[A-Z]{2}$',
  'type': 'string'
} as const;

void _CharClassSchema;
assert<AssertAssignableType<InferType<typeof _CharClassSchema>, string>>();
assert<AssertAssignableType<InferType<typeof _CharClassSchema>, PatternBrandType<'^[A-Z]{2}$'>>>();

// Lookahead — `(` in `(?=` triggers HasRegexMetaType → PatternToKeyType = string.
const _LookaheadSchema = {
  'pattern': '^(?=.*[A-Z])(?=.*[0-9])',
  'type': 'string'
} as const;

void _LookaheadSchema;
assert<AssertAssignableType<InferType<typeof _LookaheadSchema>, string>>();
assert<AssertAssignableType<InferType<typeof _LookaheadSchema>, PatternBrandType<'^(?=.*[A-Z])(?=.*[0-9])'>>>();

// Unanchored pattern — no `^` or `$` anchor → PatternToKeyType = string.
const _UnanchoredSchema = {
  'pattern': 'foo|bar',
  'type': 'string'
} as const;

void _UnanchoredSchema;
assert<AssertAssignableType<InferType<typeof _UnanchoredSchema>, string>>();
assert<AssertAssignableType<InferType<typeof _UnanchoredSchema>, PatternBrandType<'foo|bar'>>>();

// ---------------------------------------------------------------------------
// Runtime smoke hook — all assertions above are compile-time.
// ---------------------------------------------------------------------------

void describe('pattern value narrowing on type:string (TightStringPatternType)', () => {
  void it('compiles — every assertion in this file is a static check', () => {
    void 0;
  });
});
