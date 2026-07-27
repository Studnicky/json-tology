import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { CODEGEN_REGISTRY_OPTIONS_DEF } from '../constants/CODEGEN_OPTION_DEFS.js';

/**
 * Options object for {@link buildIndexSource}.
 *
 * @remarks
 * Bundles all parameters needed to generate the index.ts content for
 * registry-directory mode into a single options shape.
 *
 * @example
 * ```ts
 * buildIndexSource({ ctx, collisions, header, schemasConst, registryConstName, effectiveBaseIri, result });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toRegistryFiles}
 * @group OWL Codegen
 */
export namespace BuildIndexSourceOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Deduplicated list of IRI base names that collided during name generation. */
      'collisions': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Extra comment lines for the banner. */
      'header': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      ...CODEGEN_REGISTRY_OPTIONS_DEF.properties
    },
    'required': [
      'collisions',
      'header',
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

    return Array.isArray(value.collisions) && value.collisions.every((entry) => {
      return typeof entry === 'string';
    })
      && typeof value.effectiveBaseIri === 'string'
      && Array.isArray(value.header) && value.header.every((entry) => {
      return typeof entry === 'string';
    })
      && typeof value.registryConstName === 'string'
      && typeof value.schemasConst === 'string';
  }
}
