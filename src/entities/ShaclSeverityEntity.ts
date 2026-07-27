import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * ShaclSeverityEntity — severity level for a SHACL validation result.
 *
 * Aligned with the SHACL specification:
 * - `Violation` — the constraint is violated (contributes to non-conformance).
 * - `Warning`   — the constraint is not satisfied but does not block conformance.
 * - `Info`      — informational result; no impact on conformance.
 *
 * @category SHACL
 * @since 0.20.0
 * @see {@link https://www.w3.org/TR/shacl/#results-severity SHACL Severity}
 * @group Types
 */
export namespace ShaclSeverityEntity {
  export const Schema = {
    'enum': [
      'Info',
      'Violation',
      'Warning'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'Info' || candidate === 'Violation' || candidate === 'Warning';
  }
}
