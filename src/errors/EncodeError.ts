/**
 * EncodeError — thrown when an encode transform fails
 *
 * Raised when a schema's registered encode function throws while turning a
 * decoded rich value back into its wire representation (e.g. Date → string).
 * The original throw is preserved on `cause`. Consumers writing custom encode
 * handlers may throw `EncodeError` directly to attach a message and context;
 * the library propagates it with `schemaId`/`path` filled in.
 */

import type { TransformErrorOptionsType } from '../types/ErrorOptions.js';
import { TransformError } from './TransformError.js';

export class EncodeError extends TransformError {
  /**
   * Create an EncodeError describing a failed encode transform.
   *
   * @param message - Human-readable description of the failure
   * @param options - Options bag with required `code` and `direction`, plus optional `schemaId`,
   *   `path`, `cause`, and `retryable`
   */
  public constructor(message: string, options: TransformErrorOptionsType) {
    super(message, options);
    this.name = 'EncodeError';
  }
}
