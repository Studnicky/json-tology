/**
 * SchemaError — thrown for schema registration and structure issues
 */

import { BaseError } from './BaseError.js';

export type SchemaErrorCodeType =
  | 'SCHEMA_MISSING_ID'
  | 'SCHEMA_NOT_REGISTERED'
  | 'SCHEMA_STRUCTURE_INVALID'
  | 'SCHEMA_VALIDATOR_MISSING';

export class SchemaError extends BaseError {
  public readonly schemaId?: string | undefined;

  public constructor(code: SchemaErrorCodeType, message: string, schemaId?: string, options?: { 'cause'?: Error }) {
    super(code, message, false, options);
    this.name = 'SchemaError';
    this.schemaId = schemaId;
  }

  public override toJson() {
    return {
      ...super.toJson(),
      ...(this.schemaId !== undefined ? { 'schemaId': this.schemaId } : {})
    };
  }
}
