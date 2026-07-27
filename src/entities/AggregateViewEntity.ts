import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Aggregate summary of all validation errors for a single value.
 *
 * @remarks
 * Provides a denormalised view of the error collection: the total failure
 * count, the distinct keywords that fired, and the distinct JSON Pointer paths
 * that failed. Consumers can use this for quick dashboard-style reporting
 * without iterating individual error entries.
 *
 * @example
 * ```ts
 * const view: AggregateViewEntity.Type = {
 *   count: 3,
 *   keywords: ['minLength', 'pattern'],
 *   paths: ['/username', '/email'],
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace AggregateViewEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'count': { 'type': 'number' },
      'keywords': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'paths': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': [
      'count',
      'keywords',
      'paths'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.count === 'number'
      && Array.isArray(value.keywords)
      && value.keywords.every((entry) => {
        return typeof entry === 'string';
      })
      && Array.isArray(value.paths)
      && value.paths.every((entry) => {
        return typeof entry === 'string';
      });
  }
}
