import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `GraphError`.
 *
 * @remarks
 * Produced during canonical graph construction, pointer resolution, anchor
 * lookup, `$ref` resolution, and dialect or vocabulary handling. Switch on
 * `error.code` to distinguish between unresolved references, invalid pointers,
 * recursion limits, and unsupported vocabulary declarations.
 *
 * @example
 * ```ts
 * import { GraphErrorCodeEntity } from 'json-tology/types';
 * function handleGraph(code: GraphErrorCodeEntity.Type): void {
 *   if (code === 'REF_UNRESOLVED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link SchemaErrorCodeEntity}
 * @group Error Codes
 */
export namespace GraphErrorCodeEntity {
  export const Schema = {
    'enum': [
      'ANCHOR_NOT_FOUND',
      'ARTIFACT_INVALID',
      'ARTIFACT_STALE',
      'CURSOR_CARDINALITY',
      'DIALECT_UNSUPPORTED',
      'INVALID_LANGUAGE_TAG',
      'INVALID_PREDICATE_IRI',
      'POINTER_INVALID',
      'POINTER_NOT_FOUND',
      'POINTER_NOT_SCHEMA',
      'RECURSION_LIMIT',
      'REF_NOT_FOUND',
      'REF_UNRESOLVED',
      'VOCABULARY_UNSUPPORTED'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string' && (Schema.enum as readonly string[]).includes(candidate);
  }
}
