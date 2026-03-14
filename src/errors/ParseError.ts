/**
 * ParseError — thrown by parse() on validation failure
 *
 * Carries a ValidationErrors collection with the full structured error list.
 */

import type { ValidationErrorType } from '../types/validation.js';
import { ValidationErrors } from './ValidationErrors.js';
import { BaseError } from './BaseError.js';

export class ParseError extends BaseError {
  public readonly errors: ValidationErrors;

  public constructor(errors: ValidationErrors | ValidationErrorType[], options?: { 'cause'?: Error }) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);

    super('PARSE_FAILED', validationErrors.messages().join('; '), false, options);
    this.name = 'ParseError';
    this.errors = validationErrors;
  }

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

  public override toJson() {
    return {
      ...super.toJson(),
      'errors': this.errors.items.map((item) => {
        return { ...item };
      })
    };
  }
}
