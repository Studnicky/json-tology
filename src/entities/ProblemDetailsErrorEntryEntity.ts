import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * A single error entry in an RFC 7807 Problem Details response.
 *
 * @remarks
 * Each entry describes one validation failure: the JSON Schema keyword that
 * triggered it, a human-readable message, structured keyword-specific
 * parameters, and the JSON Pointer path to the offending value.
 *
 * @example
 * ```ts
 * const entry: ProblemDetailsErrorEntryEntity.Type = {
 *   keyword: 'minLength',
 *   message: 'must be at least 3 characters',
 *   params: { limit: 3 },
 *   path: '/username',
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace ProblemDetailsErrorEntryEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'keyword': { 'type': 'string' },
      'message': { 'type': 'string' },
      'params': { 'type': 'object' },
      'path': { 'type': 'string' }
    },
    'required': [
      'keyword',
      'message',
      'params',
      'path'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.keyword === 'string'
      && typeof value.message === 'string'
      && typeof value.params === 'object' && value.params !== null
      && typeof value.path === 'string';
  }
}
