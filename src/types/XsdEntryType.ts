import type { InferType } from './Schema.js';
import { XSD_JSON_SCHEMA_PRIMITIVE_SCHEMA } from './XsdJsonSchemaPrimitiveType.js';

/**
 * One row in the canonical XSD type table.
 *
 * @remarks
 * Used internally by {@link ENTRIES} in `XSD_REVERSE_MAPS.ts`. Consumers
 * should use the derived maps ({@link XSD_TO_JSON_SCHEMA}, {@link XSD_TO_SCHEMA_TYPE},
 * {@link SUPPORTED_XSD_DATATYPES}) rather than iterating the raw entries.
 *
 * @internal
 */
export const XSD_ENTRY_SCHEMA = {
  'properties': {
    'full': { 'type': 'string' },
    'prefixed': { 'type': 'string' },
    'primitive': XSD_JSON_SCHEMA_PRIMITIVE_SCHEMA,
    'supported': { 'type': 'boolean' }
  },
  'required': [
    'full',
    'prefixed',
    'primitive',
    'supported'
  ],
  'type': 'object'
} as const;

export type XsdEntryType = InferType<typeof XSD_ENTRY_SCHEMA>;
