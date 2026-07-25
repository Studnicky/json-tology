import type { InferType } from './Schema.js';

export const SHACL_VALIDATION_RESULT_SCHEMA = {
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
} as const;

/**
 * ShaclValidationResultType — a single SHACL validation result entry.
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
export type ShaclValidationResultType = InferType<typeof SHACL_VALIDATION_RESULT_SCHEMA>;
