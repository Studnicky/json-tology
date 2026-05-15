import type {
  FailResultInterface, PassResultInterface, ResultInterface
} from '../../interfaces/Result.js';
import { InstantiationError } from '../../errors/InstantiationError.js';
import type { ValidationErrors } from '../../errors/ValidationErrors.js';

export class Result<T> implements ResultInterface<T> {
  /**
   * Create a failed Result carrying validation errors.
   *
   * @param errors - Validation errors explaining the failure
   * @returns Failed Result with no data
   */
  static fail<T extends unknown>(errors: ValidationErrors): Result<T> {
    return new Result<T>({
      'data': undefined,
      'errors': errors,
      'success': false
    });
  }

  /**
   * Create a successful Result carrying validated data.
   *
   * @param data - Validated data
   * @returns Successful Result with data
   */
  static pass<T extends unknown>(data: T): Result<T> {
    return new Result<T>({
      'data': data,
      'errors': undefined,
      'success': true
    });
  }

  public readonly data: T | undefined;
  public readonly errors: undefined | ValidationErrors;
  public readonly success: boolean;

  private constructor(inner: FailResultInterface | PassResultInterface<T>) {
    this.success = inner.success;
    this.data = inner.data;
    this.errors = inner.errors;
  }

  /**
   * Transform the data inside a successful Result, passing failures through unchanged.
   *
   * @param transform - Function to apply to the contained data
   * @returns New Result with the transformed data, or the original failure
   */
  map<U extends unknown>(transform: (data: T) => U): Result<U> {
    if (this.success) {
      // success === true guarantees data is T (set by pass())
      return Result.pass(transform(this.data as T));
    }

    // success === false guarantees errors is ValidationErrors (set by fail())
    return Result.fail<U>(this.errors as ValidationErrors);
  }

  /**
   * Extract the data from a successful Result, or compute a fallback from the errors.
   *
   * @param fallback - Function to produce a value from validation errors on failure
   * @returns The contained data on success, or the fallback value on failure
   */
  orElse(fallback: (errors: ValidationErrors) => T): T {
    if (this.success) {
      return this.data as T;
    }

    return fallback(this.errors as ValidationErrors);
  }

  /**
   * Extract the data from a successful Result, or throw a InstantiationError on failure.
   *
   * @returns The contained data
   * @throws {@link InstantiationError} When the Result represents a failure
   */
  unwrap(): T {
    if (!this.success) {
      throw new InstantiationError(this.errors as ValidationErrors);
    }

    return this.data as T;
  }
}
