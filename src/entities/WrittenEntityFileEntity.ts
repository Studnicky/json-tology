import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Metadata for a file written to disk by `writeRegistryDirectory`
 * (Node-only, `json-tology/owl-gen-node`).
 *
 * Mirrors the pre-refactor `GenerateRegistryDirectoryEntityFileEntity.Type` shape
 * for consumers that previously depended on written absolute paths.
 */
export namespace WrittenEntityFileEntity {
  export const Schema = {
    'properties': {
      'iri': { 'type': 'string' },
      'name': { 'type': 'string' },
      'path': { 'type': 'string' }
    },
    'required': [
      'iri',
      'name',
      'path'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.iri === 'string'
      && typeof value.name === 'string'
      && typeof value.path === 'string';
  }
}
