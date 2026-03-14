/**
 * SchemaError — thrown for schema registration and structure issues
 */

import { BaseError } from './BaseError.js';

export type SchemaErrorCodeType
  = | 'SCHEMA_DIALECT_UNSUPPORTED'
  | 'SCHEMA_DUPLICATE_ANCHOR'
  | 'SCHEMA_MISSING_ID'
  | 'SCHEMA_NOT_REGISTERED'
  | 'SCHEMA_STRUCTURE_INVALID'
  | 'SCHEMA_VALIDATOR_MISSING';

export const SchemaErrorCode = {
  'DIALECT_UNSUPPORTED': 'SCHEMA_DIALECT_UNSUPPORTED',
  'DUPLICATE_ANCHOR': 'SCHEMA_DUPLICATE_ANCHOR',
  'MISSING_ID': 'SCHEMA_MISSING_ID',
  'NOT_REGISTERED': 'SCHEMA_NOT_REGISTERED',
  'STRUCTURE_INVALID': 'SCHEMA_STRUCTURE_INVALID',
  'VALIDATOR_MISSING': 'SCHEMA_VALIDATOR_MISSING'
} as const satisfies Record<string, SchemaErrorCodeType>;

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
      ...(this.schemaId === undefined ? {} : { 'schemaId': this.schemaId })
    };
  }
}
