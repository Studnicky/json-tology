import type { InferType } from './Schema.js';
import type { PASS_RESULT_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Internal discriminated union for the pass (success) branch.
 * Carries a validated value; errors is always undefined.
 */
export type PassResultType<T> = InferType<typeof PASS_RESULT_SCHEMA> & {
  'data': T;
  'errors': undefined;
};
