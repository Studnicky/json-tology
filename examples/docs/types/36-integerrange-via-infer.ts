/**
 * IntegerRangeType — Example: Deriving automatically via InferType.
 *
 * When a schema declares `type: 'integer'` with a small `minimum` /
 * `maximum` range, InferType produces the literal union directly.
 * Reach for IntegerRangeType<Min, Max> only when you need the range
 * without an underlying schema.
 */

import type {
  InferType, IntegerRangeType
} from '../../../src/types/index.js';
import type { RatingScoreSchema } from '../bookstore/index.js';

// RatingScoreSchema: { type: 'integer', minimum: 1, maximum: 5 }
type Rating = InferType<typeof RatingScoreSchema>;
// 1 | 2 | 3 | 4 | 5 — derived from the schema automatically.

// Use IntegerRangeType only when you need the range without a schema:
type RatingManual = IntegerRangeType<1, 5>;
// 1 | 2 | 3 | 4 | 5 — explicit form.

// Both unions are structurally compatible.
const fromSchema: Rating = 3;
const fromManual: RatingManual = fromSchema;

void fromManual;
