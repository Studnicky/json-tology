import type { CoercionErrorOptionsInterface } from '../interfaces/CoercionErrorOptionsInterface.js';
import type { ErrorJsonEntity } from '../entities/ErrorJsonEntity.js';
import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';
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
 *     console.error(err.errors.items); // ValidationErrorEntity.Type[]
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
  public constructor(errors: ValidationErrorEntity.Type[] | ValidationErrors, options: CoercionErrorOptionsInterface) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);
    const message = validationErrors.items.map((error: ValidationErrorEntity.Type): string => {
      const result = `${error.path || 'root'}: ${error.message}`;

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
