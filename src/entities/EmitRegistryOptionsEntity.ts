import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { CODEGEN_REGISTRY_OPTIONS_DEF } from '../constants/CODEGEN_OPTION_DEFS.js';

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
      /** Ordered list of PascalCase schema identifiers. */
      'schemaNames': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      ...CODEGEN_REGISTRY_OPTIONS_DEF.properties
    },
    'required': [
      'schemaNames',
      ...CODEGEN_REGISTRY_OPTIONS_DEF.required
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
