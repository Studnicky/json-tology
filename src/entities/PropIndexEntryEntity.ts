/**
 * PropIndexEntryEntity — internal per-property accumulator built during the graph
 * traversal pass in the Properties dispatcher.
 */

import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { PropertyIndexValueEntity } from './PropertyIndexValueEntity.js';

export namespace PropIndexEntryEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      ...PropertyIndexValueEntity.Schema.properties,
      'propertyIri': { 'type': 'string' }
    },
    'required': [
      ...PropertyIndexValueEntity.Schema.required,
      'propertyIri'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (!PropertyIndexValueEntity.validate(candidate)) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.propertyIri === 'string';
  }
}
