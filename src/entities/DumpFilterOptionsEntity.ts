import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Filtering options shared by dump-to-JSON helpers.
 */
export namespace DumpFilterOptionsEntity {
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
      }
    },
    'required': [],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  function isStringArray(entry: unknown): boolean {
    return Array.isArray(entry) && entry.every((item) => {
      return typeof item === 'string';
    });
  }

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.exclude === undefined || isStringArray(value.exclude))
      && (value.excludeDefaults === undefined || typeof value.excludeDefaults === 'boolean')
      && (value.excludeUnset === undefined || typeof value.excludeUnset === 'boolean')
      && (value.include === undefined || isStringArray(value.include));
  }
}
