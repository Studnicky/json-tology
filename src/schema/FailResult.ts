/**
 * FailResult — failed parse result
 */

import { ValidationErrors } from './ValidationErrors.js';
import { ParseError } from './ParseError.js';
import type { OkResult } from './OkResult.js';

/**
 * Returned by safeParse() on failure.
 * Access `.errors` directly or use the shared methods via the ParseResult union type.
 *
 * TypeScript narrows `ParseResult<T>` to `FailResult<T>` when `result.success === false`.
 */
export class FailResult<T> {
  public readonly success = false as const;

  public constructor(public readonly errors: ValidationErrors) {}

  /** Passes the failure through — the mapping function is never called. */
  public map<U>(_transform: (data: T) => U): FailResult<U> {
    return this as unknown as FailResult<U>;
  }

  /** Recover from failure by calling `fallback` with the errors. */
  public orElse(fallback: (errors: ValidationErrors) => T): T {
    return fallback(this.errors);
  }

  /** Always throws a ParseError containing the errors. */
  public unwrap(): never {
    throw new ParseError(this.errors);
  }
}

/**
 * Discriminated union returned by safeParse().
 *
 * Narrow via `result.success`:
 * ```ts
 * if (result.success) {
 *   result.data    // T — TypeScript knows this is OkResult<T>
 * } else {
 *   result.errors  // ValidationErrors — TypeScript knows this is FailResult<T>
 * }
 * ```
 *
 * Or use the shared methods without narrowing:
 * ```ts
 * result.map(user => user.name)
 * result.orElse(() => defaultUser)
 * result.unwrap()   // returns T or throws ParseError
 * ```
 */
export type ParseResult<T> = OkResult<T> | FailResult<T>;
