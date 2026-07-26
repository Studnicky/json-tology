import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * One detected duplicate sub-schema shape report entry.
 */
export namespace DuplicateReportEntryEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'equivalentTo': { 'type': 'string' },
      'pointer': { 'type': 'string' },
      'schemaId': { 'type': 'string' },
      'shape': { 'type': 'object' }
    },
    'required': [
      'equivalentTo',
      'pointer',
      'schemaId',
      'shape'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.equivalentTo === 'string'
      && typeof value.pointer === 'string'
      && typeof value.schemaId === 'string'
      && typeof value.shape === 'object' && value.shape !== null;
  }
}
