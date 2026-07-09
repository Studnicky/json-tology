import type { ErrorJsonType } from '../types/ErrorJsonType.js';
import type { CoercionErrorOptionsType } from '../types/ErrorOptions.js';
import type { ValidationErrorType } from '../types/Validation.js';
import { ValidationErrors } from './ValidationErrors.js';
import { BaseError } from './BaseError.js';

/**
 * CoercionError — carries a {@link ValidationErrors} collection describing why a value could not be coerced to its schema.
 *
 * @remarks
 * Thrown by coercion operations when a value cannot be cast or converted to the
 * shape described by its schema. The `errors` property exposes the full structured
 * collection of per-field validation failures.
 *
 * @example
 * ```ts
 * try {
 *   registry.coerce(UserSchema, rawValue);
 * } catch (err) {
 *   if (err instanceof CoercionError) {
 *     console.error(err.errors.items); // ValidationErrorType[]
 *   }
 * }
 * ```
 *
 * @category Errors
 * @since 0.1.0
 * @see {@link ValidationErrors}
 * @group Errors
 */
export class CoercionError extends BaseError {
  public readonly errors: ValidationErrors;

  /**
   * Create a CoercionError from validation errors, joining their messages as the error message.
   *
   * @param errors - Validation errors as a collection or raw array
   * @param options - Options bag with required `code` and optional `cause`
   */
  public constructor(errors: ValidationErrors | ValidationErrorType[], options: CoercionErrorOptionsType) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);
    const message = validationErrors.items.map((err: ValidationErrorType): string => {
      const result = `${err.path || 'root'}: ${err.message}`;

      return result;
    }).join('; ');

    super(message, options);
    this.name = 'CoercionError';
    this.errors = validationErrors;
  }

  /**
   * Walk the cause chain and append individual validation error items as additional entries.
   *
   * @returns Flat array of error JSON objects including per-field validation details
   */
  public override flatten(): ErrorJsonType[] {
    return [
      ...super.flatten(),
      ...this.errors.items.map((item: ValidationErrorType): ErrorJsonType => {
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
      'errors': this.errors.items.map((item: ValidationErrorType): ValidationErrorType => {
        return { ...item };
      })
    };
  }
}
