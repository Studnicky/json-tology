import type { XsdJsonSchemaPrimitiveInterface } from './XsdJsonSchemaPrimitiveInterface.js';

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
export interface XsdEntryInterface {
  readonly 'full': string;
  readonly 'prefixed': string;
  readonly 'primitive': XsdJsonSchemaPrimitiveInterface;
  readonly 'supported': boolean;
}
