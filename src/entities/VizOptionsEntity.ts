import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** @internal — CLI visualization option shape; consumed only by the viz subpath, not the public package surface. */
export namespace VizOptionsEntity {
  export const Schema = {
    'properties': {
      'noOpen': { 'type': 'boolean' },
      'output': { 'type': 'string' },
      'schema': { 'type': 'string' }
    },
    'required': [
      'noOpen',
      'output',
      'schema'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.noOpen === 'boolean'
      && typeof value.output === 'string'
      && typeof value.schema === 'string';
  }
}
