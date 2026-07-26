import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * A generated entity file returned by {@link generateRegistryDirectory}.
 *
 * Carries the file source and a relative path (e.g. `entities/Person.ts`).
 * The Node-only writer (`writeRegistryDirectory`) resolves these to absolute
 * paths before writing and returns {@link WrittenEntityFileEntity.Type} instead.
 */
export namespace GenerateRegistryDirectoryEntityFileEntity {
  export const Schema = {
    'properties': {
      'iri': { 'type': 'string' },
      'name': { 'type': 'string' },
      'path': { 'type': 'string' },
      'source': { 'type': 'string' }
    },
    'required': [
      'iri',
      'name',
      'path',
      'source'
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
      && typeof value.path === 'string'
      && typeof value.source === 'string';
  }
}
