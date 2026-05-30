/**
 * TransformError — base class for directional transform failures
 *
 * Thrown when a decode (wire→rich) or encode (rich→wire) transform function
 * throws. Consumers writing custom decode/encode handlers may throw
 * {@link DecodeError} or {@link EncodeError} directly to attach a code and
 * message; the library catches and re-throws them with schemaId/path context
 * filled in automatically.
 */

import type { TransformErrorCodeType } from '../types/ErrorCodes.js';
import type { TransformDirectionType } from '../types/TransformDirection.js';
import { BaseError } from './BaseError.js';

export class TransformError extends BaseError {
  public readonly direction: TransformDirectionType;
  public readonly path?: string;
  public readonly schemaId?: string;

  /**
   * Create a TransformError with a direction, code, and optional context.
   *
   * @param code - Machine-readable transform error code
   * @param message - Human-readable description of the failure
   * @param options - Direction, optional schemaId/path, cause, and retryable flag
   */
  public constructor(
    code: TransformErrorCodeType,
    message: string,
    options: {
      'cause'?: Error;
      'direction': TransformDirectionType;
      'path'?: string;
      'retryable'?: boolean;
      'schemaId'?: string;
    }
  ) {
    super(code, message, options.cause === undefined
      ? undefined
      : {
        'cause': options.cause,
        ...(options.retryable === undefined ? {} : { 'retryable': options.retryable })
      });
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
