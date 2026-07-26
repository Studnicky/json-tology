import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `SchemaLoadError`.
 *
 * @remarks
 * Produced when the schema loader fails to fetch or parse a remote schema.
 * `SCHEMA_LOAD_FAILED` covers fetch failures, missing `$id`, and invalid schema content.
 *
 * @example
 * ```ts
 * import { SchemaLoadErrorCodeEntity } from 'json-tology/types';
 * function handleLoad(code: SchemaLoadErrorCodeEntity.Type): void {
 *   if (code === 'SCHEMA_LOAD_FAILED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.25.0
 * @see {@link GraphErrorCodeEntity}
 * @group Error Codes
 */
export namespace SchemaLoadErrorCodeEntity {
  export const Schema = {
    'enum': ['SCHEMA_LOAD_FAILED'],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'SCHEMA_LOAD_FAILED';
  }
}
