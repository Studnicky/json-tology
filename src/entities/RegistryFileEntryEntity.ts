import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Describes one entity file produced by {@link OwlCodegen.toRegistryFiles}.
 *
 * @category Codegen
 * @since 0.18.0
 * @group OWL Codegen
 */
export namespace RegistryFileEntryEntity {
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
