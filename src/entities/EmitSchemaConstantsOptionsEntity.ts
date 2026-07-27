import type { JSONSchema } from 'json-schema-to-ts';
import type {
  InferType, JsonSchemaDocumentObjectType
} from '../types/Schema.js';

/**
 * Options object for the {@link emitSchemaConstants} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit per-class schema constants into a
 * single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * emitSchemaConstants(lines, { sortedIris, nameMap, schemas });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export namespace EmitSchemaConstantsOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Map from IRI to PascalCase identifier. */
      'nameMap': {
        'additionalProperties': { 'type': 'string' },
        'type': 'object'
      },
      /** IRIs in emission order. */
      'sortedIris': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': [
      'nameMap',
      'sortedIris'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  // `schemas` holds full JSON Schema documents, which are recursive/
  // self-describing and cannot themselves be re-expressed as a JSON Schema
  // literal without circularity — composed in directly as documented data.
  // NOTE: this intersection trips @studnicky/type-alias-invariants
  // ('inlineObject' on the `schemas` member); no schema-derived remedy
  // exists for a self-referential JSON Schema document type, same category
  // as the documented exceptions in src/types/ConstraintBrands.ts.
  export type Type = InferType<typeof Schema> & {
    /** All consumer-facing schemas. */
    'schemas': JsonSchemaDocumentObjectType[];
  };

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.nameMap === 'object' && value.nameMap !== null
      && Object.values(value.nameMap as Record<string, unknown>).every((entry) => {
        return typeof entry === 'string';
      })
      && Array.isArray(value.schemas)
      && Array.isArray(value.sortedIris)
      && value.sortedIris.every((entry) => {
        return typeof entry === 'string';
      });
  }
}
