import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ValidationIssueEntity } from './ValidationIssueEntity.js';

/**
 * JSON Schema for a single validation error produced by the graph engine.
 *
 * @remarks
 * Describes one constraint violation found during validation or coercion.
 * Each error carries the `keyword` that triggered it (e.g. `'type'`, `'required'`),
 * a human-readable `message`, a `params` object with keyword-specific context,
 * and a JSON Pointer `path` to the failing value in the input document. Composes
 * `ValidationIssueEntity`, adding a stable `$id` and per-field descriptions.
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
        ...ValidationIssueEntity.Schema.properties.keyword,
        'description': 'Schema keyword that triggered the error'
      },
      'message': {
        ...ValidationIssueEntity.Schema.properties.message,
        'description': 'Human-readable error message'
      },
      'params': {
        ...ValidationIssueEntity.Schema.properties.params,
        'description': 'Keyword-specific parameters'
      },
      'path': {
        ...ValidationIssueEntity.Schema.properties.path,
        'description': 'JSON Pointer path to the failing value'
      }
    },
    'required': ValidationIssueEntity.Schema.required,
    'type': ValidationIssueEntity.Schema.type
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const result = ValidationIssueEntity.validate(candidate);

    return result;
  }
}
