import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `CoercionError`.
 *
 * @remarks
 * Produced when a value cannot be coerced to the target schema type.
 * Carries a `ValidationErrors` collection describing each failed constraint.
 *
 * @example
 * ```ts
 * import { CoercionErrorCodeEntity } from 'json-tology/types';
 * function isCoercionCode(code: string): code is CoercionErrorCodeEntity.Type {
 *   return code === 'COERCION_FAILED';
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link SchemaErrorCodeEntity}
 * @group Error Codes
 */
export namespace CoercionErrorCodeEntity {
  export const Schema = {
    'enum': ['COERCION_FAILED'],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'COERCION_FAILED';
  }
}
