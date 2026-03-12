/**
 * ParseError — thrown by parse() and FailResult.unwrap() on validation failure
 */

import type { ValidationError } from '../interfaces/validation.js';
import { ValidationErrors } from './ValidationErrors.js';

/**
 * Thrown by parse() and FailResult.unwrap() on validation failure.
 * `.errors` is a ValidationErrors instance with the full structured error list.
 */
export class ParseError extends Error {
  public readonly errors: ValidationErrors;

  public constructor(errors: ValidationError[] | ValidationErrors) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);

    super(validationErrors.messages().join('; '));
    this.name = 'ParseError';
    this.errors = validationErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
