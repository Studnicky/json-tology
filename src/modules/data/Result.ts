import type { ResultInterface } from '../../interfaces/result.js';
import { ParseError } from '../../errors/ParseError.js';
import type { ValidationErrors } from '../../errors/ValidationErrors.js';

export class Result<T> implements ResultInterface<T> {
  static fail<T>(errors: ValidationErrors): Result<T> {
    return new Result<T>(false, undefined, errors);
  }

  static pass<T>(data: T): Result<T> {
    return new Result<T>(true, data, undefined);
  }

  private constructor(
    public readonly success: boolean,
    public readonly data: T | undefined,
    public readonly errors: undefined | ValidationErrors
  ) {}

  map<U>(transform: (data: T) => U): Result<U> {
    return this.success
      ? Result.pass(transform(this.data as T))
      : Result.fail<U>(this.errors as ValidationErrors);
  }

  orElse(fallback: (errors: ValidationErrors) => T): T {
    return this.success ? this.data as T : fallback(this.errors as ValidationErrors);
  }

  unwrap(): T {
    if (!this.success) {
      throw new ParseError(this.errors as ValidationErrors);
    }

    return this.data as T;
  }
}
