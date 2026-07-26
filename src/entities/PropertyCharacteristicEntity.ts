import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * A single OWL property characteristic discovered during import — e.g.
 * `subPropertyOf:<parentIri>` or `inverseOf:<targetIri>` — paired with the
 * property IRI it was discovered on.
 */
export namespace PropertyCharacteristicEntity {
  export const Schema = {
    'properties': {
      'characteristic': { 'type': 'string' },
      'propertyIri': { 'type': 'string' }
    },
    'required': [
      'characteristic',
      'propertyIri'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.characteristic === 'string'
      && typeof value.propertyIri === 'string';
  }
}
