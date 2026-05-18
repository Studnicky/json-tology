/**
 * Anti-pattern: Large IntegerRangeType bounds.
 *
 * IntegerRangeType caps at 50 entries to keep TypeScript compilation
 * fast. Ranges larger than that silently fall back to `number`,
 * defeating the literal-union narrowing. For wide ranges, use a
 * branded `number` type or runtime validation instead.
 */

import type { IntegerRangeType } from '../../../src/types/index.js';

// ⊥ Don't do this — exceeds the cap. Even attempting to instantiate
// the type can blow the TypeScript depth limiter:
//
//   type ArticleId = IntegerRangeType<1, 1000>;
//
// The utility's own design treats out-of-cap maxima as `number`, but
// you should avoid asking for the type at all. Model wide ranges with
// runtime validation:
type ArticleId = number;

// ✓ Use IntegerRangeType only at small caps:
type SmallId = IntegerRangeType<1, 10>;
// 1 | 2 | 3 | ... | 10

const wide: ArticleId = 999;
const narrow: SmallId = 7;

console.assert(typeof wide === 'number');
void narrow;
