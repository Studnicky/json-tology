import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `SchemaError`.
 *
 * @remarks
 * Produced during schema registration, structure validation, or when a
 * required schema cannot be located. Switch on `error.code` to distinguish
 * between missing `$id`, duplicate registrations, and dialect mismatches.
 *
 * @example
 * ```ts
 * import { SchemaErrorCodeEntity } from 'json-tology/types';
 * function handleSchema(code: SchemaErrorCodeEntity.Type): void {
 *   if (code === 'SCHEMA_MISSING_ID') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeEntity}
 * @group Error Codes
 */
export namespace SchemaErrorCodeEntity {
  export const Schema = {
    'enum': [
      'COMPUTED_FN_MISSING',
      'COMPUTED_INPUT_FORBIDDEN',
      'PROPERTY_CHARACTERISTIC_CONFLICT',
      'SCHEMA_DEFAULT_CREATOR_MISSING',
      'SCHEMA_DIALECT_UNSUPPORTED',
      'SCHEMA_DUPLICATE_ANCHOR',
      'SCHEMA_DUPLICATE_ID',
      'SCHEMA_DUPLICATE_SHAPE',
      'SCHEMA_IDENTITY_CONTRADICTION',
      'SCHEMA_INVALID_INPUT',
      'SCHEMA_MISSING_ID',
      'SCHEMA_NOT_REGISTERED',
      'SCHEMA_STRUCTURE_INVALID',
      'SCHEMA_VALIDATOR_MISSING'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string' && (Schema.enum as readonly string[]).includes(candidate);
  }
}
