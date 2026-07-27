import type { InstantiationErrorOptionsInterface } from '../interfaces/InstantiationErrorOptionsInterface.js';
import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';
import type { ValidationErrors } from './ValidationErrors.js';
import { ValidationCollectionError } from './ValidationCollectionError.js';

/**
 * InstantiationError — thrown by instantiate() on validation failure.
 *
 * @remarks
 * Carries a {@link ValidationErrors} collection with the full structured error list.
 * Thrown when data crosses a trust boundary (HTTP bodies, queue messages,
 * file imports) and fails validation. The `errors` property exposes per-field
 * failures for structured error handling.
 *
 * @example
 * ```ts
 * try {
 *   registry.instantiate(UserSchema, rawBody);
 * } catch (err) {
 *   if (err instanceof InstantiationError) {
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
export class InstantiationError extends ValidationCollectionError {
  /**
   * Create an InstantiationError from validation errors, joining their messages as the error message.
   *
   * @param errors - Validation errors as a collection or raw array
   * @param options - Options bag with required `code`, optional `cause` and `message` override
   */
  public constructor(errors: ValidationErrorEntity.Type[] | ValidationErrors, options: InstantiationErrorOptionsInterface) {
    const validationErrors = ValidationCollectionError.normalize(errors);
    const message = options.message ?? ValidationCollectionError.joinMessages(validationErrors);

    super(message, options, validationErrors);
    this.name = 'InstantiationError';
  }
}
