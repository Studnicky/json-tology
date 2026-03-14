/**
 * LoadError — thrown when schema file loading fails and stopOnError is set
 */

import { BaseError } from './BaseError.js';

export type LoadErrorCodeType
  = | 'LOAD_DUPLICATE_ANCHOR'
  | 'LOAD_DUPLICATE_ID'
  | 'LOAD_INVALID_JSON'
  | 'LOAD_INVALID_SCHEMA'
  | 'LOAD_IO_FAILURE'
  | 'LOAD_MISSING_ID';

export const LoadErrorCode = {
  'DUPLICATE_ANCHOR': 'LOAD_DUPLICATE_ANCHOR',
  'DUPLICATE_ID': 'LOAD_DUPLICATE_ID',
  'INVALID_JSON': 'LOAD_INVALID_JSON',
  'INVALID_SCHEMA': 'LOAD_INVALID_SCHEMA',
  'IO_FAILURE': 'LOAD_IO_FAILURE',
  'MISSING_ID': 'LOAD_MISSING_ID'
} as const satisfies Record<string, LoadErrorCodeType>;

export class LoadError extends BaseError {
  public readonly filePath: string;

  public constructor(code: LoadErrorCodeType, message: string, filePath: string, options?: { 'cause'?: Error }) {
    super(code, message, true, options);
    this.name = 'LoadError';
    this.filePath = filePath;
  }

  public override toJson() {
    return {
      ...super.toJson(),
      'filePath': this.filePath
    };
  }
}
