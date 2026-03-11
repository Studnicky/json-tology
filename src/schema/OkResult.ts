/**
 * OkResult — successful parse result
 */

import { ValidationErrors } from './ValidationErrors.js';

/**
 * Returned by safeParse() on success.
 * Access `.data` directly or use the shared methods via the ParseResult union type.
 *
 * TypeScript narrows `ParseResult<T>` to `OkResult<T>` when `result.success === true`.
 */
export class OkResult<T> {
  public readonly success = true as const;

  public constructor(public readonly data: T) {}

  /** Transform the data value. Returns a new OkResult. */
  public map<U>(transform: (data: T) => U): OkResult<U> {
    return new OkResult(transform(this.data));
  }

  /** Returns data — the fallback is never used on a successful result. */
  public orElse(_fallback: (errors: ValidationErrors) => T): T {
    return this.data;
  }

  /** Returns data directly. Never throws. */
  public unwrap(): T {
    return this.data;
  }
}
