import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Options bag carrying an optional serialization format string. */
export namespace FormatOptionsEntity {
  export const Schema = {
    'properties': { 'format': { 'type': 'string' } },
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return value.format === undefined || typeof value.format === 'string';
  }
}
