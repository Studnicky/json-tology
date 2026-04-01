/**
 * LoadError — thrown when schema file loading fails and stopOnError is set
 */

import type { LoadErrorCodeType } from '../types/ErrorCodes.js';
import { BaseError } from './BaseError.js';

export class LoadError extends BaseError {
  public readonly filePath: string;

  /**
   * Create a LoadError for file loading failures.
   *
   * @param code - Load-specific error code
   * @param message - Human-readable error description
   * @param filePath - Path to the file that failed to load
   * @param options - Optional cause for error chaining
   */
  public constructor(code: LoadErrorCodeType, message: string, filePath: string, options?: { 'cause'?: Error }) {
    super(code, message, true, options);
    this.name = 'LoadError';
    this.filePath = filePath;
  }

  /**
   * Serialize to a JSON-safe object, including the file path.
   *
   * @returns Plain object with code, message, retryable, and filePath
   */
  public override toJson() {
    return {
      ...super.toJson(),
      'filePath': this.filePath
    };
  }
}
