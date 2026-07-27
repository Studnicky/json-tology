import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { SCHEMA_OUTPUT_OPTIONS_DEF } from '../constants/CLI_OPTION_DEFS.js';

/** @internal — CLI visualization option shape; consumed only by the viz subpath, not the public package surface. */
export namespace VizOptionsEntity {
  export const Schema = {
    'properties': {
      'noOpen': { 'type': 'boolean' },
      ...SCHEMA_OUTPUT_OPTIONS_DEF.properties
    },
    'required': [
      'noOpen',
      ...SCHEMA_OUTPUT_OPTIONS_DEF.required
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
