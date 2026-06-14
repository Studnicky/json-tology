/**
 * BaseError — root error class for all json-tology errors
 *
 * Every error carries a machine-readable code, human message,
 * retryable flag, and optional cause chain. Provides toJson()
 * and flatten() for structured consumption.
 */

import type { ErrorJsonType } from '../types/Error.js';
import type { BaseErrorOptionsType } from '../types/ErrorOptions.js';
import type { ValidationErrorType } from '../types/Validation.js';

export class BaseError extends Error {
  private static readonly EMPTY_PARAMS: Record<string, unknown> = Object.freeze({});

  private static errorToJson(error: Error): ErrorJsonType {
    if (error instanceof BaseError) {
      return {
        'code': error.code,
        'message': error.message,
        'retryable': error.retryable
      };
    }

    return {
      'code': 'UNKNOWN',
      'message': error.message,
      'retryable': false
    };
  }

  /**
   * Format an array of validation errors into path-prefixed strings.
   */
  static formatErrors(errors: readonly ValidationErrorType[]): string[] {
    return errors.map((error) => {
      return BaseError.formatPath(error);
    });
  }

  /**
   * Format a validation error as "path: message", using "root" when the path is empty.
   */
  static formatPath(error: ValidationErrorType): string {
    return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
  }
  /**
   * Normalize an unknown caught value into an `Error` suitable for a `.cause` chain.
   * Returns the value unchanged when it is already an `Error`; otherwise wraps
   * `String(error)` in a plain `Error`.
   */
  static toCause(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
  static validationError(
    path: string,
    keyword: string,
    message: string,
    params?: Record<string, unknown>
  ): ValidationErrorType {
    return {
      keyword,
      message,
      'params': params ?? BaseError.EMPTY_PARAMS,
      path
    };
  }
  public override readonly cause?: Error | undefined;
  public readonly code: string;

  public override name = 'BaseError';

  public readonly retryable: boolean;

  /**
   * Create a BaseError with a machine-readable code, human message, and optional overrides.
   *
   * @param message - Human-readable error description
   * @param options - Options bag containing `options.code` (machine-readable error code),
   *   optional `options.retryable` flag, and optional `options.cause` for error chaining
   */
  public constructor(message: string, options: BaseErrorOptionsType) {
    super(message, options);
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Walk the cause chain and return a flat array of error JSON objects,
   * root-first.
   */
  public flatten(): ErrorJsonType[] {
    const chain: ErrorJsonType[] = [BaseError.errorToJson(this)];
    let cursor: Error | undefined = this.cause instanceof Error ? this.cause : undefined;

    while (cursor !== undefined) {
      chain.push(BaseError.errorToJson(cursor));
      cursor = cursor.cause instanceof Error ? cursor.cause : undefined;
    }

    return chain;
  }

  /**
   * Serialize to a plain JSON-safe object, including the cause chain.
   */
  public toJson(): ErrorJsonType {
    const json: ErrorJsonType = {
      'code': this.code,
      'message': this.message,
      'retryable': this.retryable
    };

    if (this.cause instanceof BaseError) {
      json.cause = this.cause.toJson();
    } else if (this.cause instanceof Error) {
      json.cause = {
        'code': 'UNKNOWN',
        'message': this.cause.message,
        'retryable': false
      };
    }

    return json;
  }
}
