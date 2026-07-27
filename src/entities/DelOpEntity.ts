import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Diff operation: delete the value at `path`.
 */
export namespace DelOpEntity {
  export const Schema = {
    'properties': {
      'op': { 'const': 'delete' },
      'path': { 'type': 'string' }
    },
    'required': [
      'op',
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

    return value.op === 'delete'
      && typeof value.path === 'string';
  }
}
