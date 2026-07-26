import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options object for the {@link emitRegistryConstruction} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit the registry array and
 * `JsonTology.create()` call into a single options shape.
 *
 * @example
 * ```ts
 * emitRegistryConstruction(lines, { schemasConst, registryConstName, schemaNames, effectiveBaseIri });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export namespace EmitRegistryOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Effective base IRI for `JsonTology.create`. */
      'effectiveBaseIri': { 'type': 'string' },
      /** Name of the exported registry constant. */
      'registryConstName': { 'type': 'string' },
      /** Ordered list of PascalCase schema identifiers. */
      'schemaNames': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Name of the exported schemas array constant. */
      'schemasConst': { 'type': 'string' }
    },
    'required': [
      'effectiveBaseIri',
      'registryConstName',
      'schemaNames',
      'schemasConst'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;
    const schemaNamesAreStrings = Array.isArray(value.schemaNames)
      && value.schemaNames.every((item: unknown): boolean => {
        return typeof item === 'string';
      });

    return typeof value.effectiveBaseIri === 'string'
      && typeof value.registryConstName === 'string'
      && schemaNamesAreStrings
      && typeof value.schemasConst === 'string';
  }
}
