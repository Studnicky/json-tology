import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Filtering and serialization-mode options for the `dump` helper.
 */
export namespace DumpOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Property names to drop from the output. Ignored when `include` is provided. */
      'exclude': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Drop properties whose runtime value strictly equals the schema's `default`. */
      'excludeDefaults': { 'type': 'boolean' },
      /** Drop properties whose runtime value is `undefined`. */
      'excludeUnset': { 'type': 'boolean' },
      /** Property names to keep. Takes precedence over `exclude` when both are set. */
      'include': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** 'wire' = plain JS values; 'json' = JSON.stringify-safe (Date→ISO, etc.). Default 'wire'. */
      'mode': {
        'enum': [
          'json',
          'wire'
        ],
        'type': 'string'
      }
    },
    'required': [],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.exclude === undefined || (Array.isArray(value.exclude) && value.exclude.every((entry) => {
      return typeof entry === 'string';
    })))
      && (value.excludeDefaults === undefined || typeof value.excludeDefaults === 'boolean')
      && (value.excludeUnset === undefined || typeof value.excludeUnset === 'boolean')
      && (value.include === undefined || (Array.isArray(value.include) && value.include.every((entry) => {
        return typeof entry === 'string';
      })))
      && (value.mode === undefined || value.mode === 'json' || value.mode === 'wire');
  }
}
