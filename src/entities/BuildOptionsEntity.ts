import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { SCHEMA_OUTPUT_OPTIONS_DEF } from '../constants/CLI_OPTION_DEFS.js';

/** @internal — CLI build option shape; not part of the public package surface. */
export namespace BuildOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'baseIri': { 'type': 'string' },
      'format': { 'type': 'string' },
      'outputFile': { 'type': 'string' },
      ...SCHEMA_OUTPUT_OPTIONS_DEF.properties
    },
    'required': [
      'format',
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

    return typeof value.format === 'string'
      && typeof value.output === 'string'
      && typeof value.schema === 'string'
      && (value.baseIri === undefined || typeof value.baseIri === 'string')
      && (value.outputFile === undefined || typeof value.outputFile === 'string');
  }
}
