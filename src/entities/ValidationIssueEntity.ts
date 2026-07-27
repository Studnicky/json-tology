import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Shared JSON Schema fields for a single constraint-violation entry: the
 * `keyword` that triggered it, a human-readable `message`, keyword-specific
 * `params`, and a JSON Pointer `path` to the offending value.
 *
 * @remarks
 * Composed by `ProblemDetailsErrorEntryEntity` (RFC 7807 error entries) and
 * `ValidationErrorEntity` (internal validation errors), which differ only in
 * `$id` / `additionalProperties` / per-field descriptions.
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace ValidationIssueEntity {
  export const Schema = {
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
