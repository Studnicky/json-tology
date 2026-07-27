import type { CoercionErrorOptionsInterface } from '../interfaces/CoercionErrorOptionsInterface.js';
import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';
import type { ValidationErrors } from './ValidationErrors.js';
import { ValidationCollectionError } from './ValidationCollectionError.js';

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
export class CoercionError extends ValidationCollectionError {
  /**
   * Create a CoercionError from validation errors, joining their messages as the error message.
   *
   * @param errors - Validation errors as a collection or raw array
   * @param options - Options bag with required `code` and optional `cause`
   */
  public constructor(errors: ValidationErrorEntity.Type[] | ValidationErrors, options: CoercionErrorOptionsInterface) {
    const validationErrors = ValidationCollectionError.normalize(errors);
    const message = ValidationCollectionError.joinMessages(validationErrors);

    super(message, options, validationErrors);
    this.name = 'CoercionError';
  }
}
