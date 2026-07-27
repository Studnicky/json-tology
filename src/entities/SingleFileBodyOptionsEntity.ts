import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for {@link buildSingleFileBody}.
 *
 * @remarks
 * Bundles the computed context for single-file mode TypeScript emission
 * so that `OwlCodegen.toTypeScript` stays within the 50-line limit.
 *
 * @example
 * ```ts
 * buildSingleFileBody({ sortedIris, nameMap, schemas, effectiveBaseIri, inferTypeImportPath, registryConstName });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export namespace SingleFileBodyOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Effective base IRI for `JsonTology.create`. */
      'effectiveBaseIri': { 'type': 'string' },
      /** Import path for `InferType`. */
      'inferTypeImportPath': { 'type': 'string' },
      /** Map from IRI to PascalCase identifier. */
      'nameMap': {
        'additionalProperties': { 'type': 'string' },
        'type': 'object'
      },
      /** Name of the exported registry constant. */
      'registryConstName': { 'type': 'string' },
      /** Sorted IRIs in emission order. */
      'sortedIris': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': [
      'effectiveBaseIri',
      'inferTypeImportPath',
      'nameMap',
      'registryConstName',
      'sortedIris'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  // `schemas` holds JsonSchemaDocumentObjectType[] — a recursive JSON-Schema
  // meta-schema shape that cannot itself be expressed as JSON Schema without
  // infinite regress, so it is composed in as a documented exception.
  export type Type = InferType<typeof Schema> & { 'schemas': JsonSchemaDocumentObjectType[] };

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.effectiveBaseIri === 'string'
      && typeof value.inferTypeImportPath === 'string'
      && typeof value.nameMap === 'object' && value.nameMap !== null
      && typeof value.registryConstName === 'string'
      && Array.isArray(value.sortedIris)
      && value.sortedIris.every((entry) => {
        return typeof entry === 'string';
      })
      && Array.isArray(value.schemas);
  }
}
