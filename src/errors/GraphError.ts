/**
 * GraphError — thrown for graph resolution failures
 *
 * Covers pointer resolution, anchor lookup, ref resolution, and dialect issues.
 */

import type { GraphErrorCodeType } from '../types/error-codes.js';
import { BaseError } from './BaseError.js';

export class GraphError extends BaseError {
  public readonly pointer?: string | undefined;

  /**
   * Create a GraphError for graph resolution failures such as pointer, anchor, or ref resolution.
   *
   * @param code - Graph-specific error code
   * @param message - Human-readable error description
   * @param pointer - JSON Pointer where the error occurred
   * @param options - Optional cause for error chaining
   */
  public constructor(code: GraphErrorCodeType, message: string, pointer?: string, options?: { 'cause'?: Error }) {
    super(code, message, false, options);
    this.name = 'GraphError';
    this.pointer = pointer;
  }

  /**
   * Serialize to a JSON-safe object, including the pointer when present.
   *
   * @returns Plain object with code, message, retryable, and optional pointer
   */
  public override toJson() {
    return {
      ...super.toJson(),
      ...(this.pointer === undefined ? {} : { 'pointer': this.pointer })
    };
  }
}
