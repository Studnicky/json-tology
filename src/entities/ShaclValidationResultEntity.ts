import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { ShaclSeverityEntity } from './ShaclSeverityEntity.js';

/**
 * ShaclValidationResultEntity — a single SHACL validation result entry.
 *
 * Aligned with the SHACL specification `sh:ValidationResult` shape.
 * Produced by `ShaclValidator.validate()` for each constraint violation,
 * warning, or informational finding.
 *
 * @category SHACL
 * @since 0.20.0
 * @see {@link https://www.w3.org/TR/shacl/#results-validation-result SHACL ValidationResult}
 * @group Interfaces
 */
export namespace ShaclValidationResultEntity {
  export const Schema = {
    'properties': {
      'focusNode': { 'type': 'string' },
      'resultMessage': { 'type': 'string' },
      'resultPath': { 'type': 'string' },
      'resultSeverity': {
        'enum': [
          'Info',
          'Violation',
          'Warning'
        ]
      },
      'sourceConstraintComponent': { 'type': 'string' },
      'sourceShape': { 'type': 'string' },
      'value': { 'type': 'string' }
    },
    'required': [
      'focusNode',
      'resultMessage',
      'resultSeverity',
      'sourceConstraintComponent'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.focusNode === 'string'
      && typeof value.resultMessage === 'string'
      && ShaclSeverityEntity.validate(value.resultSeverity)
      && typeof value.sourceConstraintComponent === 'string';
  }
}
