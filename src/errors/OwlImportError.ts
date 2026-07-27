/**
 * OwlImportError — thrown by the OWL 2 TBox import pipeline.
 *
 * Covers malformed JSON-LD input (`PARSE_FAILED`) and the absence of the
 * optional `jsonld` peer dependency required for non-quad JSON-LD input
 * (`PEER_DEPENDENCY_MISSING`).
 */

import type { OwlImportErrorOptionsInterface } from '../interfaces/OwlImportErrorOptionsInterface.js';
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
  public constructor(message: string, options: OwlImportErrorOptionsInterface) {
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
