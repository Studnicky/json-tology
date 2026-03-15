/**
 * GraphError — thrown for graph resolution failures
 *
 * Covers pointer resolution, anchor lookup, ref resolution, and dialect issues.
 */

import type { GraphErrorCodeType } from '../types/error-codes.js';
import { BaseError } from './BaseError.js';

export class GraphError extends BaseError {
  public readonly pointer?: string | undefined;

  public constructor(code: GraphErrorCodeType, message: string, pointer?: string, options?: { 'cause'?: Error }) {
    super(code, message, false, options);
    this.name = 'GraphError';
    this.pointer = pointer;
  }

  public override toJson() {
    return {
      ...super.toJson(),
      ...(this.pointer === undefined ? {} : { 'pointer': this.pointer })
    };
  }
}
