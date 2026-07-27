import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Diff operation: set a value at `path`.
 */
export namespace SetOpEntity {
  export const Schema = {
    'properties': {
      'op': { 'const': 'set' },
      'path': { 'type': 'string' },
      'value': true
    },
    'required': [
      'op',
      'path',
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

    return value.op === 'set' && typeof value.path === 'string' && 'value' in value;
  }
}
