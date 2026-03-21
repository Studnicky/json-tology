import type { ResultInterface } from '../../interfaces/result.js';
import { CoercionError } from '../../errors/CoercionError.js';
import type { ValidationErrors } from '../../errors/ValidationErrors.js';

export class Result<T> implements ResultInterface<T> {
  /**
   * Create a failed Result carrying validation errors.
   *
   * @param errors - Validation errors explaining the failure
   * @returns Failed Result with no data
   */
  static fail<T>(errors: ValidationErrors): Result<T> {
    return new Result<T>(false, undefined, errors);
  }

  /**
   * Create a successful Result carrying validated data.
   *
   * @param data - Validated data
   * @returns Successful Result with data
   */
  static pass<T>(data: T): Result<T> {
    return new Result<T>(true, data, undefined);
  }

  private constructor(
    public readonly success: boolean,
    public readonly data: T | undefined,
    public readonly errors: undefined | ValidationErrors
  ) {}

  /**
   * Transform the data inside a successful Result, passing failures through unchanged.
   *
   * @param transform - Function to apply to the contained data
   * @returns New Result with the transformed data, or the original failure
   */
  map<U>(transform: (data: T) => U): Result<U> {
    return this.success
      ? Result.pass(transform(this.data as T))
      : Result.fail<U>(this.errors as ValidationErrors);
  }

  /**
   * Extract the data from a successful Result, or compute a fallback from the errors.
   *
   * @param fallback - Function to produce a value from validation errors on failure
   * @returns The contained data on success, or the fallback value on failure
   */
  orElse(fallback: (errors: ValidationErrors) => T): T {
    return this.success ? this.data as T : fallback(this.errors as ValidationErrors);
  }

  /**
   * Extract the data from a successful Result, or throw a CoercionError on failure.
   *
   * @returns The contained data
   * @throws {@link CoercionError} When the Result represents a failure
   */
  unwrap(): T {
    if (!this.success) {
      throw new CoercionError(this.errors as ValidationErrors);
    }

    return this.data as T;
  }
}
