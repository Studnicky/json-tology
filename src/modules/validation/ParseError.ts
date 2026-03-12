/**
 * ParseError — thrown by parse() on validation failure
 */

import type { ValidationErrorType } from '../../types/validation.js';
import { BaseError } from '../errors/BaseError.js';
import { ValidationErrors } from './ValidationErrors.js';

/**
 * Thrown by parse() on validation failure.
 * `.errors` is a ValidationErrors instance with the full structured error list.
 */
export class ParseError extends BaseError {
  public readonly errors: ValidationErrors;

  public constructor(errors: ValidationErrorType[] | ValidationErrors) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);

    super(validationErrors.messages().join('; '));
    this.name = 'ParseError';
    this.errors = validationErrors;
  }
}
