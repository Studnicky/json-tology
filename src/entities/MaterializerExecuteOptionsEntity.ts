import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options accepted by {@link MaterializerInterface.execute}.
 */
export namespace MaterializerExecuteOptionsEntity {
  export const Schema = {
    'properties': {
      'baseIri': { 'type': 'string' },
      'data': {},
      'synthesizeDefaults': { 'type': 'boolean' }
    },
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.baseIri === undefined || typeof value.baseIri === 'string')
      && (value.synthesizeDefaults === undefined || typeof value.synthesizeDefaults === 'boolean');
  }
}
