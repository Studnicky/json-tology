import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `TransformError`.
 *
 * @remarks
 * Produced when a `Transform` pipeline stage fails to decode or encode a value.
 * `TRANSFORM_DECODE_FAILED` is thrown on the inbound path; `TRANSFORM_ENCODE_FAILED`
 * on the outbound path.
 *
 * @example
 * ```ts
 * import { TransformErrorCodeEntity } from 'json-tology/types';
 * function handleTransform(code: TransformErrorCodeEntity.Type): void {
 *   if (code === 'TRANSFORM_DECODE_FAILED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link CoercionErrorCodeEntity}
 * @group Error Codes
 */
export namespace TransformErrorCodeEntity {
  export const Schema = {
    'enum': [
      'TRANSFORM_DECODE_FAILED',
      'TRANSFORM_ENCODE_FAILED'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'TRANSFORM_DECODE_FAILED' || candidate === 'TRANSFORM_ENCODE_FAILED';
  }
}
