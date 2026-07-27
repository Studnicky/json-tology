import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Node in the schema relationship graph. */
export namespace VizNodeEntity {
  export const Schema = {
    'properties': {
      'id': { 'type': 'string' },
      'label': { 'type': 'string' },
      'propertyCount': { 'type': 'number' },
      'schemaTypes': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': [
      'id',
      'label',
      'propertyCount',
      'schemaTypes'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.id === 'string'
      && typeof value.label === 'string'
      && typeof value.propertyCount === 'number'
      && Array.isArray(value.schemaTypes)
      && value.schemaTypes.every((entry) => {
        return typeof entry === 'string';
      });
  }
}
