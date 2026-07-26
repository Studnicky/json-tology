import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
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
      /** Generated source for `index.ts`. */
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

    return Array.isArray(value.entityFiles)
      && typeof value.indexSource === 'string';
  }
}
