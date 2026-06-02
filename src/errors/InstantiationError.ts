import type { ErrorJsonInterface } from '../interfaces/Error.js';
import type { InstantiationErrorCodeType } from '../types/ErrorCodes.js';
import type { ValidationErrorType } from '../types/Validation.js';
import { ValidationErrors } from './ValidationErrors.js';
import { BaseError } from './BaseError.js';

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
export class InstantiationError extends BaseError {
  public readonly errors: ValidationErrors;

  /**
   * Create an InstantiationError from validation errors, joining their messages as the error message.
   *
   * @param errors - Validation errors as a collection or raw array
   * @param options - Optional cause for error chaining, code override, and message override
   */
  public constructor(
    errors: ValidationErrors | ValidationErrorType[],
    options?: {
      'cause'?: Error;
      'code'?: InstantiationErrorCodeType;
      'message'?: string;
    }
  ) {
    const validationErrors = errors instanceof ValidationErrors ? errors : new ValidationErrors(errors);
    const joinedMessages = options?.message ?? validationErrors.items.map((err: ValidationErrorType): string => {
      return `${err.path || 'root'}: ${err.message}`;
    }).join('; ');

    super(
      options?.code ?? 'INSTANTIATION_FAILED',
      joinedMessages,
      options?.cause === undefined ? undefined : { 'cause': options.cause }
    );
    this.name = 'InstantiationError';
    this.errors = validationErrors;
  }

  /**
   * Walk the cause chain and append individual validation error items as additional entries.
   *
   * @returns Flat array of error JSON objects including per-field validation details
   */
  public override flatten(): ErrorJsonInterface[] {
    return [
      ...super.flatten(),
      ...this.errors.items.map((item: ValidationErrorType): ErrorJsonInterface => {
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
