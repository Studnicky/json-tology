/**
 * XsdJsonSchemaPrimitiveType — the JSON-Schema shape that a recognised XSD
 * type maps to.
 *
 * `format` is present only for XSD types that carry a JSON Schema format
 * counterpart (e.g. xsd:dateTime → `{ type: 'string', format: 'date-time' }`).
 *
 * Consumed by the canonical reverse XSD→JSON-Schema map
 * (src/constants/XSD_REVERSE_MAPS.ts) and by the OWL import property dispatch.
 */

import type { InferType } from './Schema.js';

export const XSD_JSON_SCHEMA_PRIMITIVE_SCHEMA = {
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
} as const;

export type XsdJsonSchemaPrimitiveType = InferType<typeof XSD_JSON_SCHEMA_PRIMITIVE_SCHEMA>;
