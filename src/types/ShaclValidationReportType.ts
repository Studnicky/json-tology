/**
 * ShaclValidationReportType — the top-level SHACL conformance report.
 *
 * Aligned with the SHACL specification `sh:ValidationReport` shape.
 * Returned by `ShaclValidator.validate()` and `JsonTology.validateWithShacl()`.
 *
 * `conforms` is `true` if and only if there are zero results with
 * `resultSeverity === 'Violation'`.
 *
 * @category SHACL
 * @since 0.20.0
 * @see {@link https://www.w3.org/TR/shacl/#validation-report SHACL Validation Report}
 * @group Interfaces
 */
import type { ShaclValidationResultType } from './ShaclValidationResultType.js';

export type ShaclValidationReportType = {
  /**
   * Whether the data graph conforms to the shapes graph.
   * `true` iff `results` contains no entries with `resultSeverity === 'Violation'`.
   */
  readonly 'conforms': boolean;
  /**
   * All validation results produced during shape evaluation.
   * Empty when the data conforms.
   */
  readonly 'results': readonly ShaclValidationResultType[];
};
