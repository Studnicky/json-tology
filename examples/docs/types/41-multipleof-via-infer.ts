/**
 * MultipleOfRangeType — Example: Deriving automatically via InferType.
 *
 * When a schema declares both `minimum`/`maximum` and `multipleOf`,
 * InferType produces the stepped literal union directly. Use
 * MultipleOfRangeType<Min, Max, Step> only when you need the same
 * shape without an underlying schema.
 */

import type {
  InferType, MultipleOfRangeType
} from '../../../src/types/index.js';

const _EvenQuantitySchema = {
  'maximum': 10,
  'minimum': 0,
  'multipleOf': 2,
  'type': 'integer'
} as const;

type EvenQuantity = InferType<typeof _EvenQuantitySchema>;
// 0 | 2 | 4 | 6 | 8 | 10 — derived from the schema automatically.

// Use MultipleOfRangeType explicitly only when you need it without a schema:
type EvenQuantityManual = MultipleOfRangeType<0, 10, 2>;

const fromSchema: EvenQuantity = 4;
const fromManual: EvenQuantityManual = fromSchema;

// Both hold the same value: InferType and MultipleOfRangeType produce
// the same literal union 0 | 2 | 4 | 6 | 8 | 10 for these parameters.
console.log('from schema (InferType):', fromSchema);
console.log('from manual (MultipleOfRangeType):', fromManual);
