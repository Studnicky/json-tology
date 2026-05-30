/**
 * EncodeError — thrown when an encode transform fails
 *
 * Raised when a schema's registered encode function throws while turning a
 * decoded rich value back into its wire representation (e.g. Date → string).
 * The original throw is preserved on `cause`. Consumers writing custom encode
 * handlers may throw `EncodeError` directly to attach a message and context;
 * the library propagates it with `schemaId`/`path` filled in.
 */

import { TransformError } from './TransformError.js';

export class EncodeError extends TransformError {
  /**
   * Create an EncodeError describing a failed encode transform.
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
    super('TRANSFORM_ENCODE_FAILED', message, {
      'direction': 'encode',
      ...options
    });
    this.name = 'EncodeError';
  }
}
