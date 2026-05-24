/**
 * GraphError — thrown for graph resolution failures
 *
 * Covers pointer resolution, anchor lookup, ref resolution, and dialect issues.
 */

import type { GraphErrorCodeType } from '../types/ErrorCodes.js';
import type { GraphErrorOptionsType } from '../types/ErrorOptions.js';
import { BaseError } from './BaseError.js';

export class GraphError extends BaseError {
  public readonly pointer?: string | undefined;

  /**
   * Create a GraphError for graph resolution failures such as pointer, anchor, or ref resolution.
   *
   * @param code - Graph-specific error code
   * @param message - Human-readable error description
   * @param options - Optional pointer and cause for error chaining
   */
  public constructor(code: GraphErrorCodeType, message: string, options?: GraphErrorOptionsType) {
    super(code, message, options?.cause === undefined ? undefined : { 'cause': options.cause });
    this.name = 'GraphError';
    this.pointer = options?.pointer;
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
