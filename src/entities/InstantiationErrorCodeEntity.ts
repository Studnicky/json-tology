import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `InstantiationError`.
 *
 * @remarks
 * Produced by `JsonTology.instantiate` when the value fails validation
 * (`INSTANTIATION_FAILED`) or when extra properties are present and the schema
 * disallows them (`EXTRA_FORBIDDEN`).
 *
 * @example
 * ```ts
 * import { InstantiationErrorCodeEntity } from 'json-tology/types';
 * function handleInstantiation(code: InstantiationErrorCodeEntity.Type): void {
 *   if (code === 'EXTRA_FORBIDDEN') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link CoercionErrorCodeEntity}
 * @group Error Codes
 */
export namespace InstantiationErrorCodeEntity {
  export const Schema = {
    'enum': [
      'EXTRA_FORBIDDEN',
      'INSTANTIATION_FAILED'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'EXTRA_FORBIDDEN' || candidate === 'INSTANTIATION_FAILED';
  }
}
