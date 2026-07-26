import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

export namespace RawRestrictionDescriptorEntity {
  export const Schema = {
    'properties': {
      'kind': { 'type': 'string' },
      'onProperty': { 'type': 'string' },
      'value': {}
    },
    'required': [
      'kind',
      'onProperty',
      'value'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.kind === 'string'
      && typeof value.onProperty === 'string'
      && 'value' in value;
  }
}
