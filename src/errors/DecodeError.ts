/**
 * DecodeError — thrown when a decode transform fails
 *
 * Raised when a schema's registered decode function throws while turning
 * validated wire data into its rich type (e.g. string → Date). The original
 * throw is preserved on `cause`. Consumers writing custom decode handlers may
 * throw `DecodeError` directly to attach a message and context; the library
 * propagates it with `schemaId`/`path` filled in.
 */

import { TransformError } from './TransformError.js';

export class DecodeError extends TransformError {
  /**
   * Create a DecodeError describing a failed decode transform.
   *
   * @param message - Human-readable description of the failure
   * @param options - Optional schemaId, JSON Pointer path, cause, and retryable flag
   */
  public constructor(
    message: string,
    options?: {
      'cause'?: Error;
      'path'?: string;
      'retryable'?: boolean;
      'schemaId'?: string;
    }
  ) {
    super('TRANSFORM_DECODE_FAILED', message, {
      'direction': 'decode',
      ...options
    });
    this.name = 'DecodeError';
  }
}
