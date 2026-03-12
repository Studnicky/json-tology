/**
 * BaseError — base class for all json-tology errors
 *
 * Provides consistent error formatting with path prefixing.
 */

import type { ValidationErrorType } from '../../types/validation.js';

export class BaseError extends Error {
  public override name: string = 'BaseError';

  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Format a validation error as "path: message", using "root" when the path is empty.
   */
  static formatPath(error: ValidationErrorType): string {
    return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
  }

  /**
   * Format an array of validation errors into path-prefixed strings.
   */
  static formatErrors(errors: readonly ValidationErrorType[]): string[] {
    return errors.map(BaseError.formatPath);
  }
}
