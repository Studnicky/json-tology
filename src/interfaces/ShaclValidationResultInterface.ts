/**
 * ShaclValidationResultInterface — a single SHACL validation result entry.
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
import type { ShaclSeverityType } from '../types/ShaclSeverityType.js';

export interface ShaclValidationResultInterface {
  /**
   * IRI or blank-node identifier of the focus node that failed validation.
   */
  readonly 'focusNode': string;
  /**
   * Human-readable description of the constraint failure.
   */
  readonly 'resultMessage': string;
  /**
   * IRI of the property path that was evaluated (absent for node-level constraints).
   */
  readonly 'resultPath'?: string;
  /**
   * Severity of this result.
   */
  readonly 'resultSeverity': ShaclSeverityType;
  /**
   * Full IRI of the SHACL constraint component that produced this result.
   * Example: `http://www.w3.org/ns/shacl#MinCountConstraintComponent`
   */
  readonly 'sourceConstraintComponent': string;
  /**
   * IRI or blank-node identifier of the shape that produced this result (when available).
   */
  readonly 'sourceShape'?: string;
  /**
   * Lexical value of the offending value node (when applicable).
   */
  readonly 'value'?: string;
}
