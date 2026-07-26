import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { RegistryFileEntryEntity } from './RegistryFileEntryEntity.js';

/**
 * Result returned by {@link OwlCodegen.toRegistryFiles}.
 *
 * @category Codegen
 * @since 0.18.0
 * @group OWL Codegen
 */
export namespace RegistryFilesResultEntity {
  export const Schema = {
    'properties': {
      /** Metadata + source for each generated `entities/<Name>.ts` file. */
      'entityFiles': {
        'items': RegistryFileEntryEntity.Schema,
        'type': 'array'
      },
      /** Source content for the generated `index.ts` file. */
      'indexSource': { 'type': 'string' }
    },
    'required': [
      'entityFiles',
      'indexSource'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return Array.isArray(value.entityFiles) && value.entityFiles.every((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }

      const entryValue = entry as Record<string, unknown>;

      return typeof entryValue.iri === 'string'
        && typeof entryValue.name === 'string'
        && typeof entryValue.path === 'string'
        && typeof entryValue.source === 'string';
    })
      && typeof value.indexSource === 'string';
  }
}
