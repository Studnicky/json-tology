import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { REGISTRY_DIRECTORY_RESULT_SHARED_SCHEMA } from '../constants/SCHEMAS.js';
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
      ...REGISTRY_DIRECTORY_RESULT_SHARED_SCHEMA.properties
    },
    'required': [
      'entityFiles',
      ...REGISTRY_DIRECTORY_RESULT_SHARED_SCHEMA.required
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    if (!Array.isArray(value.entityFiles) || typeof value.indexSource !== 'string') {
      return false;
    }

    for (const entry of value.entityFiles) {
      if (!RegistryFileEntryEntity.validate(entry)) {
        return false;
      }
    }

    return true;
  }
}
