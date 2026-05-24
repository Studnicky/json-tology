/**
 * SchemaError — thrown for schema registration and structure issues
 */

import type { SchemaErrorCodeType } from '../types/ErrorCodes.js';
import type { SchemaErrorOptionsType } from '../types/ErrorOptions.js';
import { BaseError } from './BaseError.js';

export class SchemaError extends BaseError {
  public readonly schemaId?: string | undefined;

  /**
   * Create a SchemaError for schema registration or structure issues.
   *
   * @param code - Schema-specific error code
   * @param message - Human-readable error description
   * @param options - Optional schemaId and cause for error chaining
   */
  public constructor(code: SchemaErrorCodeType, message: string, options?: SchemaErrorOptionsType) {
    super(code, message, options?.cause === undefined ? undefined : { 'cause': options.cause });
    this.name = 'SchemaError';
    this.schemaId = options?.schemaId;
  }

  /**
   * Serialize to a JSON-safe object, including the schema ID when present.
   *
   * @returns Plain object with code, message, retryable, and optional schemaId
   */
  public override toJson() {
    return {
      ...super.toJson(),
      ...(this.schemaId === undefined ? {} : { 'schemaId': this.schemaId })
    };
  }
}
