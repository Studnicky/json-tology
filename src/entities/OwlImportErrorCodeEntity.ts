import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `OwlImportError`.
 *
 * @remarks
 * Produced when an OWL import fails. `OWL_IMPORT_PARSE_FAILED` indicates
 * malformed JSON-LD input; `OWL_IMPORT_PEER_DEPENDENCY_MISSING` indicates the
 * optional `jsonld` peer dependency is required for non-quad JSON-LD input but
 * is not installed.
 *
 * @example
 * ```ts
 * import { OwlImportErrorCodeEntity } from 'json-tology/types';
 * function handleOwlImport(code: OwlImportErrorCodeEntity.Type): void {
 *   if (code === 'OWL_IMPORT_PARSE_FAILED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeEntity}
 * @group Error Codes
 */
export namespace OwlImportErrorCodeEntity {
  export const Schema = {
    'enum': [
      'OWL_IMPORT_PARSE_FAILED',
      'OWL_IMPORT_PEER_DEPENDENCY_MISSING'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'OWL_IMPORT_PARSE_FAILED' || candidate === 'OWL_IMPORT_PEER_DEPENDENCY_MISSING';
  }
}
