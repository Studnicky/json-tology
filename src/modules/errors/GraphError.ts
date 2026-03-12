/**
 * GraphError — thrown for graph resolution failures
 *
 * Covers pointer resolution, anchor lookup, ref resolution, and dialect issues.
 */

import { BaseError } from './BaseError.js';

export type GraphErrorCodeType =
  | 'ANCHOR_NOT_FOUND'
  | 'BOOLEAN_SCHEMA_FRAGMENT'
  | 'DIALECT_UNSUPPORTED'
  | 'POINTER_INVALID'
  | 'POINTER_NOT_FOUND'
  | 'POINTER_NOT_SCHEMA'
  | 'REF_UNRESOLVED'
  | 'VOCABULARY_UNSUPPORTED';

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
      ...(this.pointer !== undefined ? { 'pointer': this.pointer } : {})
    };
  }
}
