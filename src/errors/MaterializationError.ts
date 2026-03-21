/**
 * MaterializationError — thrown when materialization or ABox projection fails validation
 */

import { BaseError } from './BaseError.js';

export class MaterializationError extends BaseError {
  public readonly schemaId: string;
  public readonly validationErrors: string[];

  /**
   * Create a MaterializationError for materialization or ABox projection failures.
   *
   * @param schemaId - The $id of the schema that failed materialization
   * @param validationErrors - Formatted validation error strings
   * @param options - Optional cause for error chaining
   */
  public constructor(schemaId: string, validationErrors: string[], options?: { 'cause'?: Error }) {
    super('MATERIALIZATION_FAILED', `Invalid ${schemaId}: ${validationErrors.join('; ')}`, false, options);
    this.name = 'MaterializationError';
    this.schemaId = schemaId;
    this.validationErrors = validationErrors;
  }

  /**
   * Serialize to a JSON-safe object, including the schema ID and validation errors.
   *
   * @returns Plain object with code, message, retryable, schemaId, and validationErrors
   */
  public override toJson() {
    return {
      ...super.toJson(),
      'schemaId': this.schemaId,
      'validationErrors': this.validationErrors
    };
  }
}
