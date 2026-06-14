/**
 * SchemaError — thrown for schema registration and structure issues
 */

import type { SchemaErrorOptionsType } from '../types/ErrorOptions.js';
import { BaseError } from './BaseError.js';

export class SchemaError extends BaseError {
  public readonly schemaId?: string | undefined;

  /**
   * Create a SchemaError for schema registration or structure issues.
   *
   * @param message - Human-readable error description
   * @param options - Options bag containing `options.code` (schema-specific error code),
   *   optional `options.schemaId`, and optional `options.cause` for error chaining
   */
  public constructor(message: string, options: SchemaErrorOptionsType) {
    super(message, options);
    this.name = 'SchemaError';
    this.schemaId = options.schemaId;
  }

  /**
   * Serialize to a JSON-safe object, including the schema ID when present.
   *
   * @returns Plain object with code, message, retryable, and optional schemaId
   */
  public override toJson() {
    return {
      ...super.toJson(),
      ...(!(this.schemaId === undefined) && { 'schemaId': this.schemaId })
    };
  }
}
