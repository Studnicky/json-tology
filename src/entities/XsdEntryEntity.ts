import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { XsdJsonSchemaPrimitiveEntity } from './XsdJsonSchemaPrimitiveEntity.js';

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
export namespace XsdEntryEntity {
  export const Schema = {
    'properties': {
      'full': { 'type': 'string' },
      'prefixed': { 'type': 'string' },
      'primitive': XsdJsonSchemaPrimitiveEntity.Schema,
      'supported': { 'type': 'boolean' }
    },
    'required': [
      'full',
      'prefixed',
      'primitive',
      'supported'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    if (typeof value.full !== 'string' || typeof value.prefixed !== 'string' || typeof value.supported !== 'boolean') {
      return false;
    }

    if (typeof value.primitive !== 'object' || value.primitive === null) {
      return false;
    }

    const primitive = value.primitive as Record<string, unknown>;

    return typeof primitive.type === 'string'
      && (XsdJsonSchemaPrimitiveEntity.Schema.properties.type.enum as readonly string[]).includes(primitive.type);
  }
}
