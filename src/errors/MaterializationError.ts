/**
 * MaterializationError — thrown when materialization or ABox projection fails validation
 */

import type { MaterializationErrorCodeType } from '../types/ErrorCodes.js';

import { BaseError } from './BaseError.js';

export class MaterializationError extends BaseError {
  public readonly schemaId: string;
  public readonly validationErrors: string[];

  /**
   * Create a MaterializationError for materialization or ABox projection failures.
   *
   * @param schemaId - The $id of the schema that failed materialization
   * @param validationErrors - Formatted validation error strings
   * @param options - Optional cause for error chaining and an optional code
   *   (defaults to `MATERIALIZATION_FAILED`).
   */
  public constructor(
    schemaId: string,
    validationErrors: string[],
    options?: { 'cause'?: Error;
      'code'?: MaterializationErrorCodeType;
      'message'?: string }
  ) {
    const code = options?.code ?? 'MATERIALIZATION_FAILED';
    const message = options?.message ?? `Invalid ${schemaId}: ${validationErrors.join('; ')}`;
    const causeOptions = options?.cause === undefined ? undefined : { 'cause': options.cause };

    super(code, message, causeOptions);
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
