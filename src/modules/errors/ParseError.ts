/**
 * ParseError — thrown by parse() on validation failure
 *
 * Carries a ValidationErrors collection with the full structured error list.
 */

import type { ValidationErrorType } from '../../types/validation.js';
import { ValidationErrors } from '../validation/ValidationErrors.js';
import { BaseError } from './BaseError.js';

export class ParseError extends BaseError {
  public readonly errors: ValidationErrors;

  public constructor(errors: ValidationErrorType[] | ValidationErrors, options?: { 'cause'?: Error }) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);

    super('PARSE_FAILED', validationErrors.messages().join('; '), false, options);
    this.name = 'ParseError';
    this.errors = validationErrors;
  }

  public override toJson() {
    return {
      ...super.toJson(),
      'errors': this.errors.items.map((item) => ({ ...item }))
    };
  }

  public override flatten() {
    return [
      ...super.flatten(),
      ...this.errors.items.map((item) => ({
        'code': item.keyword,
        'message': `${item.path || 'root'}: ${item.message}`,
        'retryable': false
      }))
    ];
  }
}
