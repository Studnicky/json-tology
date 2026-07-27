import type { BaseErrorOptionsInterface } from '../interfaces/BaseErrorOptionsInterface.js';
import type { ErrorJsonEntity } from '../entities/ErrorJsonEntity.js';
import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';
import { ValidationErrors } from './ValidationErrors.js';
import { BaseError } from './BaseError.js';

/**
 * ValidationCollectionError — shared base for errors that carry a {@link ValidationErrors}
 * collection (e.g. {@link CoercionError}, {@link InstantiationError}).
 *
 * @remarks
 * Normalizes the raw errors array or existing collection, joins per-field messages
 * for the default error message, and appends the structured items to `flatten()`
 * and `toJson()`.
 */
export abstract class ValidationCollectionError extends BaseError {
  /**
   * Join validation error items into a single "path: message; path: message" string.
   */
  public static joinMessages(errors: ValidationErrors): string {
    const joined = errors.items.map((error: ValidationErrorEntity.Type): string => {
      const result = `${error.path || 'root'}: ${error.message}`;

      return result;
    }).join('; ');

    return joined;
  }

  /**
   * Normalize a raw validation-error array or existing collection into a {@link ValidationErrors}.
   */
  public static normalize(errors: ValidationErrorEntity.Type[] | ValidationErrors): ValidationErrors {
    return errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);
  }

  public readonly errors: ValidationErrors;

  public override name = 'ValidationCollectionError';

  protected constructor(message: string, options: BaseErrorOptionsInterface, errors: ValidationErrors) {
    super(message, options);
    this.errors = errors;
  }

  /**
   * Walk the cause chain and append individual validation error items as additional entries.
   *
   * @returns Flat array of error JSON objects including per-field validation details
   */
  public override flatten(): ErrorJsonEntity.Type[] {
    return [
      ...super.flatten(),
      ...this.errors.items.map((item: ValidationErrorEntity.Type): ErrorJsonEntity.Type => {
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
      'errors': this.errors.items.map((item: ValidationErrorEntity.Type): ValidationErrorEntity.Type => {
        return { ...item };
      })
    };
  }
}
