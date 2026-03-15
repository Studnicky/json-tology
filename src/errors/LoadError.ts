/**
 * LoadError — thrown when schema file loading fails and stopOnError is set
 */

import type { LoadErrorCodeType } from '../types/error-codes.js';
import { BaseError } from './BaseError.js';

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
