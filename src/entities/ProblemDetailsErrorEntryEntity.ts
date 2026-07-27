import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ValidationIssueEntity } from './ValidationIssueEntity.js';

/**
 * A single error entry in an RFC 7807 Problem Details response.
 *
 * @remarks
 * Each entry describes one validation failure: the JSON Schema keyword that
 * triggered it, a human-readable message, structured keyword-specific
 * parameters, and the JSON Pointer path to the offending value. Composes
 * `ValidationIssueEntity` with `additionalProperties: false`.
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
    ...ValidationIssueEntity.Schema,
    'additionalProperties': false
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    const result = ValidationIssueEntity.validate(candidate);

    return result;
  }
}
