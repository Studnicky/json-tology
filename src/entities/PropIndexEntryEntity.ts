/**
 * PropIndexEntryEntity — internal per-property accumulator built during the graph
 * traversal pass in the Properties dispatcher.
 */

import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

export namespace PropIndexEntryEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'domains': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'inverseOf': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'propertyIri': { 'type': 'string' },
      'range': {
        'type': [
          'string',
          'null'
        ]
      },
      'subPropertyOf': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'type': {
        'enum': [
          'datatype',
          'object'
        ],
        'type': 'string'
      }
    },
    'required': [
      'domains',
      'inverseOf',
      'propertyIri',
      'range',
      'subPropertyOf',
      'type'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return Array.isArray(value.domains)
      && value.domains.every((entry) => {
        return typeof entry === 'string';
      })
      && Array.isArray(value.inverseOf)
      && value.inverseOf.every((entry) => {
        return typeof entry === 'string';
      })
      && typeof value.propertyIri === 'string'
      && (value.range === null || typeof value.range === 'string')
      && Array.isArray(value.subPropertyOf)
      && value.subPropertyOf.every((entry) => {
        return typeof entry === 'string';
      })
      && (value.type === 'datatype' || value.type === 'object');
  }
}
