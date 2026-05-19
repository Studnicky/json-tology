/**
 * OwlImportError — thrown by the OWL 2 TBox import pipeline.
 *
 * Covers unknown axiom predicates, malformed class nodes, unresolved IRI
 * references, unsupported datatypes, and not-yet-implemented dispatcher stubs.
 */

import type { OwlImportErrorCodeType } from '../types/ErrorCodes.js';
import { BaseError } from './BaseError.js';

export class OwlImportError extends BaseError {
  /** IRI of the axiom or predicate that triggered the error. */
  public readonly axiomIri: string;

  /** IRI of the subject node related to the error, or null when not applicable. */
  public readonly subjectIri: null | string;

  /**
   * Create an OwlImportError.
   *
   * @param code - OWL-import-specific error code
   * @param message - Human-readable description
   * @param axiomIri - The predicate or axiom IRI that triggered the error
   * @param subjectIri - The subject node IRI, or null when not applicable
   * @param options - Optional cause for error chaining
   */
  public constructor(
    code: OwlImportErrorCodeType,
    message: string,
    axiomIri: string,
    subjectIri: null | string,
    options?: { 'cause'?: Error }
  ) {
    super(code, message, false, options);
    this.name = 'OwlImportError';
    this.axiomIri = axiomIri;
    this.subjectIri = subjectIri;
  }

  /**
   * Serialize to a JSON-safe object, including axiomIri and subjectIri.
   */
  public override toJson() {
    return {
      ...super.toJson(),
      'axiomIri': this.axiomIri,
      ...(this.subjectIri === null ? {} : { 'subjectIri': this.subjectIri })
    };
  }
}
