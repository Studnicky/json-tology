import type { ValidationErrors } from '../errors/ValidationErrors.js';

/**
 * Internal discriminated union for the fail branch.
 * Carries validation errors; data is always undefined.
 */
export type FailResultType = {
  readonly 'data': undefined;
  readonly 'errors': ValidationErrors;
  readonly 'success': false;
};
