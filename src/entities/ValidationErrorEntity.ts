import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * JSON Schema for a single validation error produced by the graph engine.
 *
 * @remarks
 * Describes one constraint violation found during validation or coercion.
 * Each error carries the `keyword` that triggered it (e.g. `'type'`, `'required'`),
 * a human-readable `message`, a `params` object with keyword-specific context,
 * and a JSON Pointer `path` to the failing value in the input document.
 *
 * @example
 * ```ts
 * const err: ValidationErrorEntity.Type = {
 *   keyword: 'required',
 *   message: "must have required property 'id'",
 *   params: { missingProperty: 'id' },
 *   path: ''
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 */
export namespace ValidationErrorEntity {
  export const Schema = {
    '$id': 'https://json-tology.dev/ValidationError',
    'properties': {
      'keyword': {
        'description': 'Schema keyword that triggered the error',
        'type': 'string'
      },
      'message': {
        'description': 'Human-readable error message',
        'type': 'string'
      },
      'params': {
        'description': 'Keyword-specific parameters',
        'type': 'object'
      },
      'path': {
        'description': 'JSON Pointer path to the failing value',
        'type': 'string'
      }
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
