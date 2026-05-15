import type { ValidationErrors } from '../errors/ValidationErrors.js';

/**
 * Internal discriminated union for the pass (success) branch.
 * Carries a validated value; errors is always undefined.
 */
export interface PassResultInterface<T> {
  readonly 'data': T;
  readonly 'errors': undefined;
  readonly 'success': true;
}

/**
 * Internal discriminated union for the fail branch.
 * Carries validation errors; data is always undefined.
 */
export interface FailResultInterface {
  readonly 'data': undefined;
  readonly 'errors': ValidationErrors;
  readonly 'success': false;
}

export interface ResultInterface<T> {
  readonly 'data': T | undefined;
  readonly 'errors': undefined | ValidationErrors;
  map<U>(transform: (data: T) => U): ResultInterface<U>;
  orElse(fallback: (errors: ValidationErrors) => T): T;
  readonly 'success': boolean;
  unwrap(): T;
}
