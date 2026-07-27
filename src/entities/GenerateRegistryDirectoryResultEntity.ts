import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { REGISTRY_DIRECTORY_RESULT_SHARED_SCHEMA } from '../constants/SCHEMAS.js';
import { GenerateRegistryDirectoryEntityFileEntity } from './GenerateRegistryDirectoryEntityFileEntity.js';

/**
 * Data returned by {@link generateRegistryDirectory} (browser-safe).
 */
export namespace GenerateRegistryDirectoryResultEntity {
  export const Schema = {
    'properties': {
      /** Generated entity files (relative paths + source strings). */
      'entityFiles': {
        'items': GenerateRegistryDirectoryEntityFileEntity.Schema,
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
      if (!GenerateRegistryDirectoryEntityFileEntity.validate(entry)) {
        return false;
      }
    }

    return true;
  }
}
