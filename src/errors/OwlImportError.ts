/**
 * OwlImportError — thrown by the OWL 2 TBox import pipeline.
 *
 * Covers unknown axiom predicates, malformed class nodes, unresolved IRI
 * references, unsupported datatypes, and not-yet-implemented dispatcher stubs.
 */

import type { OwlImportErrorOptionsType } from '../types/ErrorOptions.js';
import { BaseError } from './BaseError.js';

export class OwlImportError extends BaseError {
  /** IRI of the axiom or predicate that triggered the error. */
  public readonly axiomIri: string;

  /** IRI of the subject node related to the error, or null when not applicable. */
  public readonly subjectIri: null | string;

  /**
   * Create an OwlImportError.
   *
   * @param message - Human-readable description
   * @param options - Options bag containing `options.code`, `options.axiomIri`,
   *   `options.subjectIri`, and optional `options.cause` for error chaining
   */
  public constructor(message: string, options: OwlImportErrorOptionsType) {
    super(message, options);
    this.name = 'OwlImportError';
    this.axiomIri = options.axiomIri;
    this.subjectIri = options.subjectIri;
  }

  /**
   * Serialize to a JSON-safe object, including axiomIri and subjectIri.
   */
  public override toJson() {
    return {
      ...super.toJson(),
      'axiomIri': this.axiomIri,
      ...(!(this.subjectIri === null) && { 'subjectIri': this.subjectIri })
    };
  }
}
