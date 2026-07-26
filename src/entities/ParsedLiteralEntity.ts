import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Result of parsing a literal token from an N-Quad line. */
export namespace ParsedLiteralEntity {
  export const Schema = {
    'properties': {
      'datatype': { 'type': 'string' },
      'language': { 'type': 'string' },
      'value': { 'type': 'string' }
    },
    'required': [
      'datatype',
      'language',
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

    return typeof value.datatype === 'string'
      && typeof value.language === 'string'
      && typeof value.value === 'string';
  }
}
