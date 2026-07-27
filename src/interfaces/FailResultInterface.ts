import type { ValidationErrors } from '../errors/ValidationErrors.js';
import type { FalseFlagEntity } from '../entities/FalseFlagEntity.js';

/**
 * Internal discriminated union for the fail branch.
 * Carries validation errors; data is always undefined.
 */
export interface FailResultInterface {
  'data': undefined;
  'errors': ValidationErrors;
  'success': FalseFlagEntity.Type;
}
