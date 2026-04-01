/**
 * SchemaError — thrown for schema registration and structure issues
 */

import type { SchemaErrorCodeType } from '../types/ErrorCodes.js';
import { BaseError } from './BaseError.js';

export class SchemaError extends BaseError {
  public readonly schemaId?: string | undefined;

  /**
   * Create a SchemaError for schema registration or structure issues.
   *
   * @param code - Schema-specific error code
   * @param message - Human-readable error description
   * @param schemaId - The $id of the schema that caused the error
   * @param options - Optional cause for error chaining
   */
  public constructor(code: SchemaErrorCodeType, message: string, schemaId?: string, options?: { 'cause'?: Error }) {
    super(code, message, false, options);
    this.name = 'SchemaError';
    this.schemaId = schemaId;
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
