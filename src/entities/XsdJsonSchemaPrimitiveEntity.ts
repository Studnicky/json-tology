/**
 * XsdJsonSchemaPrimitiveEntity — the JSON-Schema shape that a recognised XSD
 * type maps to.
 *
 * `format` is present only for XSD types that carry a JSON Schema format
 * counterpart (e.g. xsd:dateTime → `{ type: 'string', format: 'date-time' }`).
 *
 * Consumed by the canonical reverse XSD→JSON-Schema map
 * (src/constants/XSD_REVERSE_MAPS.ts) and by the OWL import property dispatch.
 */

import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

export namespace XsdJsonSchemaPrimitiveEntity {
  export const Schema = {
    'properties': {
      'format': { 'type': 'string' },
      'type': {
        'enum': [
          'boolean',
          'integer',
          'number',
          'string'
        ]
      }
    },
    'required': ['type'],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.format === undefined || typeof value.format === 'string')
      && (value.type === 'boolean' || value.type === 'integer' || value.type === 'number' || value.type === 'string');
  }
}
