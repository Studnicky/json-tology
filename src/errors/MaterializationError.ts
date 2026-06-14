/**
 * MaterializationError — thrown when materialization or ABox projection fails validation
 */

import type { MaterializationErrorOptionsType } from '../types/ErrorOptions.js';

import { BaseError } from './BaseError.js';

export class MaterializationError extends BaseError {
  public readonly schemaId: string;
  public readonly validationErrors: string[];

  /**
   * Create a MaterializationError for materialization or ABox projection failures.
   *
   * @param schemaId - The $id of the schema that failed materialization
   * @param options - Options bag with required `code`, `validationErrors`, and optional `cause` and `message`
   */
  public constructor(schemaId: string, options: MaterializationErrorOptionsType) {
    const message = options.message ?? `Invalid ${schemaId}: ${options.validationErrors.join('; ')}`;

    super(message, options);
    this.name = 'MaterializationError';
    this.schemaId = schemaId;
    this.validationErrors = options.validationErrors;
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
