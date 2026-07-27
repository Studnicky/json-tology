/**
 * SchemaLoadError — thrown when the schema loader fails to fetch or parse a schema.
 *
 * Covers HTTP 5xx transient failures (`fetch-failed`), schemas returned without
 * a `$id` (`missing-id`), and structurally invalid content (`invalid-schema`).
 *
 * @since 0.25.0
 */

import type { SchemaLoadErrorOptionsInterface } from '../interfaces/SchemaLoadErrorOptionsInterface.js';
import type { SchemaLoadErrorEntity } from '../entities/SchemaLoadErrorEntity.js';
import type { SchemaLoadReasonEntity } from '../entities/SchemaLoadReasonEntity.js';
import { BaseError } from './BaseError.js';

export class SchemaLoadError extends BaseError {
  /** The source path or IRI that failed to load. */
  public readonly file: string;

  /** Classification of the failure. */
  public readonly reason: SchemaLoadReasonEntity.Type;

  /** HTTP status code, when the failure originated from a remote fetch. */
  public readonly status: number | undefined;

  /**
   * Create a SchemaLoadError for schema load failures such as fetch errors,
   * missing `$id`, or structurally invalid content.
   *
   * @param message - Human-readable error description
   * @param options - Options bag containing `options.code`, `options.file`,
   *   `options.reason`, optional `options.status`, optional `options.retryable`,
   *   and optional `options.cause` for error chaining
   */
  public constructor(message: string, options: SchemaLoadErrorOptionsInterface) {
    super(message, options);
    this.name = 'SchemaLoadError';
    this.file = options.file;
    this.reason = options.reason;
    this.status = options.status;
  }

  /**
   * Serialize to a JSON-safe object, including file, reason, and optional status.
   *
   * @returns Plain object with code, message, retryable, file, reason, and optional status
   */
  public override toJson() {
    return {
      ...super.toJson(),
      'file': this.file,
      'reason': this.reason,
      ...(this.status !== undefined && { 'status': this.status })
    };
  }

  /**
   * Convert to a `SchemaLoadErrorEntity.Type` descriptor suitable for accumulating in
   * a `SchemaLoadResultEntity.Type`.
   *
   * @returns Plain `SchemaLoadErrorEntity.Type` with file, message, reason, and optional status
   */
  public toLoadError(): SchemaLoadErrorEntity.Type {
    return {
      'file': this.file,
      'message': this.message,
      'reason': this.reason,
      ...(this.status !== undefined && { 'status': this.status })
    };
  }
}
