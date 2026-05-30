/**
 * CoercionError — carries a {@link ValidationErrors} collection describing why a value could not be coerced to its schema.
 */

import type { ValidationErrorType } from '../types/Validation.js';
import { CoercionErrorCode } from '../constants/ERROR_CODES.js';
import { ValidationErrors } from './ValidationErrors.js';
import { BaseError } from './BaseError.js';

export class CoercionError extends BaseError {
  public readonly errors: ValidationErrors;

  /**
   * Create a CoercionError from validation errors, joining their messages as the error message.
   *
   * @param errors - Validation errors as a collection or raw array
   * @param options - Optional cause for error chaining
   */
  public constructor(errors: ValidationErrors | ValidationErrorType[], options?: { 'cause'?: Error }) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);
    const joinedMessages = validationErrors.items.map((err) => {
      return `${err.path || 'root'}: ${err.message}`;
    }).join('; ');

    super(CoercionErrorCode.COERCION_FAILED, joinedMessages, options);
    this.name = 'CoercionError';
    this.errors = validationErrors;
  }

  /**
   * Walk the cause chain and append individual validation error items as additional entries.
   *
   * @returns Flat array of error JSON objects including per-field validation details
   */
  public override flatten() {
    return [
      ...super.flatten(),
      ...this.errors.items.map((item) => {
        return {
          'code': item.keyword,
          'message': `${item.path || 'root'}: ${item.message}`,
          'retryable': false
        };
      })
    ];
  }

  /**
   * Serialize to a JSON-safe object, including the structured validation errors array.
   *
   * @returns Plain object with code, message, retryable, and errors list
   */
  public override toJson() {
    return {
      ...super.toJson(),
      'errors': this.errors.items.map((item) => {
        return { ...item };
      })
    };
  }
}
