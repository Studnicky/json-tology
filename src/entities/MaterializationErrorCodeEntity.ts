import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Error codes emitted by `MaterializationError`.
 *
 * @remarks
 * Produced during ABox projection when a value cannot be lifted into the RDF
 * graph. Covers cyclic data (`CYCLIC_DATA`), values that are not valid IRIs
 * (`INVALID_IRI_VALUE`), non-finite numbers (`NON_FINITE_NUMBER`), a missing
 * graph IRI (`MISSING_GRAPH_IRI`), and general materialization failure
 * (`MATERIALIZATION_FAILED`).
 *
 * @example
 * ```ts
 * import { MaterializationErrorCodeEntity } from 'json-tology/types';
 * function handleMaterialization(code: MaterializationErrorCodeEntity.Type): void {
 *   if (code === 'CYCLIC_DATA') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeEntity}
 * @group Error Codes
 */
export namespace MaterializationErrorCodeEntity {
  export const Schema = {
    'enum': [
      'CYCLIC_DATA',
      'INVALID_IRI_VALUE',
      'MATERIALIZATION_FAILED',
      'MISSING_GRAPH_IRI',
      'NON_FINITE_NUMBER'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'CYCLIC_DATA'
      || candidate === 'INVALID_IRI_VALUE'
      || candidate === 'MATERIALIZATION_FAILED'
      || candidate === 'MISSING_GRAPH_IRI'
      || candidate === 'NON_FINITE_NUMBER';
  }
}
