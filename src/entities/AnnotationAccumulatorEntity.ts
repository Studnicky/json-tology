import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * AnnotationAccumulatorEntity — per-entity annotation accumulator populated
 * during the Annotations dispatcher graph traversal, before values are written
 * into schemaDeltas.
 */
export namespace AnnotationAccumulatorEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'altLabels': {
        'additionalProperties': {
          'items': { 'type': 'string' },
          'type': 'array'
        },
        'type': 'object'
      },
      'comments': {
        'additionalProperties': {
          'items': { 'type': 'string' },
          'type': 'array'
        },
        'type': 'object'
      },
      'deprecated': { 'type': 'boolean' },
      'isDefinedBy': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'labels': {
        'additionalProperties': {
          'items': { 'type': 'string' },
          'type': 'array'
        },
        'type': 'object'
      },
      'seeAlso': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'versionInfo': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': [
      'altLabels',
      'comments',
      'deprecated',
      'isDefinedBy',
      'labels',
      'seeAlso',
      'versionInfo'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.altLabels === 'object' && value.altLabels !== null
      && typeof value.comments === 'object' && value.comments !== null
      && typeof value.deprecated === 'boolean'
      && Array.isArray(value.isDefinedBy)
      && typeof value.labels === 'object' && value.labels !== null
      && Array.isArray(value.seeAlso)
      && Array.isArray(value.versionInfo);
  }
}
