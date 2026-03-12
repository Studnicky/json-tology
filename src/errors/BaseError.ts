/**
 * BaseError — root error class for all json-tology errors
 *
 * Every error carries a machine-readable code, human message,
 * retryable flag, and optional cause chain. Provides toJson()
 * and flatten() for structured consumption.
 */

import type { ValidationErrorType } from '../types/validation.js';

export interface ErrorJsonInterface {
  'cause'?: ErrorJsonInterface;
  'code': string;
  'message': string;
  'retryable': boolean;
}

export class BaseError extends Error {
  public override name: string = 'BaseError';
  public readonly code: string;
  public readonly retryable: boolean;
  public override readonly cause?: Error | undefined;

  public constructor(code: string, message: string, retryable = false, options?: { 'cause'?: Error }) {
    super(message, options);
    this.code = code;
    this.retryable = retryable;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize to a plain JSON-safe object, including the cause chain.
   */
  public toJson(): ErrorJsonInterface {
    const json: ErrorJsonInterface = {
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

  /**
   * Walk the cause chain and return a flat array of error JSON objects,
   * root-first.
   */
  public flatten(): ErrorJsonInterface[] {
    const chain: ErrorJsonInterface[] = [];
    let current: Error | undefined = this;

    while (current !== undefined) {
      if (current instanceof BaseError) {
        chain.push({
          'code': current.code,
          'message': current.message,
          'retryable': current.retryable
        });
      } else {
        chain.push({
          'code': 'UNKNOWN',
          'message': current.message,
          'retryable': false
        });
      }

      current = current.cause instanceof Error ? current.cause : undefined;
    }

    return chain;
  }

  /**
   * Format a validation error as "path: message", using "root" when the path is empty.
   */
  static formatPath(error: ValidationErrorType): string {
    return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
  }

  /**
   * Format an array of validation errors into path-prefixed strings.
   */
  static formatErrors(errors: readonly ValidationErrorType[]): string[] {
    return errors.map(BaseError.formatPath);
  }
}
