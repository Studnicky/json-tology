import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ProblemDetailsErrorEntryEntity } from './ProblemDetailsErrorEntryEntity.js';

/**
 * RFC 7807 Problem Details response shape for validation failures.
 *
 * @remarks
 * Returned by `JsonTology.validate` and related methods when validation fails.
 * The `type` field identifies the error category as a URI, `status` mirrors
 * an HTTP status code (typically 422), `title` is a short human-readable
 * summary, `detail` elaborates the failure, `instance` (optional) is the JSON
 * Pointer to the root value, and `errors` lists individual keyword failures.
 *
 * @example
 * ```ts
 * const problem: ProblemDetailsEntity.Type = {
 *   type: 'https://json-tology.dev/errors/validation',
 *   status: 422,
 *   title: 'Validation Failed',
 *   detail: '2 errors found',
 *   errors: [{ keyword: 'required', message: "must have 'id'", params: {}, path: '' }],
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace ProblemDetailsEntity {
  export const Schema = {
    'properties': {
      'detail': { 'type': 'string' },
      'errors': {
        'items': ProblemDetailsErrorEntryEntity.Schema,
        'type': 'array'
      },
      'instance': { 'type': 'string' },
      'status': { 'type': 'number' },
      'title': { 'type': 'string' },
      'type': { 'type': 'string' }
    },
    'required': [
      'detail',
      'errors',
      'status',
      'title',
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

    return typeof value.detail === 'string'
      && Array.isArray(value.errors)
      && value.errors.every((entry) => {
        const result = ProblemDetailsErrorEntryEntity.validate(entry);

        return result;
      })
      && (value.instance === undefined || typeof value.instance === 'string')
      && typeof value.status === 'number'
      && typeof value.title === 'string'
      && typeof value.type === 'string';
  }
}
