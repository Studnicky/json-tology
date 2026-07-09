import type { ValidationErrors } from '../errors/ValidationErrors.js';

/**
 * Internal discriminated union for the fail branch.
 * Carries validation errors; data is always undefined.
 */
export type FailResultType = {
  'data': undefined;
  'errors': ValidationErrors;
  'success': false;
};
