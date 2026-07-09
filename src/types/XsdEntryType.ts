import type { XsdJsonSchemaPrimitiveType } from './XsdJsonSchemaPrimitiveType.js';

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
export type XsdEntryType = {
  'full': string;
  'prefixed': string;
  'primitive': XsdJsonSchemaPrimitiveType;
  'supported': boolean;
};
