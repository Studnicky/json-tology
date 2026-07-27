import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { DumpFilterOptionsEntity } from './DumpFilterOptionsEntity.js';

/**
 * Filtering and serialization-mode options for the `dump` helper.
 */
export namespace DumpOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      ...DumpFilterOptionsEntity.Schema.properties,
      /** 'wire' = plain JS values; 'json' = JSON.stringify-safe (Date→ISO, etc.). Default 'wire'. */
      'mode': {
        'enum': [
          'json',
          'wire'
        ],
        'type': 'string'
      }
    },
    'required': [...DumpFilterOptionsEntity.Schema.required],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (!DumpFilterOptionsEntity.validate(candidate)) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return value.mode === undefined || value.mode === 'json' || value.mode === 'wire';
  }
}
