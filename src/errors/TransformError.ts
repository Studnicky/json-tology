/**
 * TransformError — base class for directional transform failures
 *
 * Thrown when a decode (wire→rich) or encode (rich→wire) transform function
 * throws. Consumers writing custom decode/encode handlers may throw
 * {@link DecodeError} or {@link EncodeError} directly to attach a code and
 * message; the library catches and re-throws them with schemaId/path context
 * filled in automatically.
 */

import type { TransformErrorOptionsType } from '../types/ErrorOptions.js';
import { BaseError } from './BaseError.js';

export class TransformError extends BaseError {
  public readonly direction: TransformErrorOptionsType['direction'];
  public readonly path?: string;
  public readonly schemaId?: string;

  /**
   * Create a TransformError with a direction, code, and optional context.
   *
   * @param message - Human-readable description of the failure
   * @param options - Options bag containing `options.code`, `options.direction`,
   *   optional `options.schemaId`, `options.path`, `options.cause`, and `options.retryable`
   */
  public constructor(message: string, options: TransformErrorOptionsType) {
    super(message, options);
    this.name = 'TransformError';
    this.direction = options.direction;
    if (options.schemaId !== undefined) {
      this.schemaId = options.schemaId;
    }
    if (options.path !== undefined) {
      this.path = options.path;
    }
  }

  /**
   * Serialize to a JSON-safe object, adding direction and optional schemaId/path fields.
   *
   * @returns Plain object with all base fields plus transform-specific context
   */
  public override toJson() {
    const base = {
      ...super.toJson(),
      'direction': this.direction
    };

    if (this.schemaId !== undefined) {
      (base as Record<string, unknown>).schemaId = this.schemaId;
    }
    if (this.path !== undefined) {
      (base as Record<string, unknown>).path = this.path;
    }

    return base;
  }
}
