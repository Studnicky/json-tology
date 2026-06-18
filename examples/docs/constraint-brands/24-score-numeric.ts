/**
 * Numeric brands — `minimum` and `maximum` produce branded number types.
 *
 * With `numericBrands: true` (the default), a schema with `minimum: 0`
 * and `maximum: 100` resolves to
 * `number & MinimumBrandType<0> & MaximumBrandType<100>`.
 * A plain `number` is not assignable to `Score` without passing through
 * the validation API.
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';

const ScoreSchema = {
  '$id': 'urn:brands:Score',
  'maximum': 100,
  'minimum': 0,
  'type': 'number'
} as const;

type Score = InferType<typeof ScoreSchema>;

const jt = JsonTology.create({
  'baseIri': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [ScoreSchema]
});

const score: Score = jt.instantiate(ScoreSchema.$id, 75);

console.log('Score (min 0, max 100):', score);
console.log('Score is number:', typeof score === 'number');
