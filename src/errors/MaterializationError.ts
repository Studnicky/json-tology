/**
 * MaterializationError — thrown when materialization or ABox projection fails validation
 */

import { BaseError } from './BaseError.js';

export class MaterializationError extends BaseError {
  public readonly schemaId: string;
  public readonly validationErrors: string[];

  public constructor(schemaId: string, validationErrors: string[], options?: { 'cause'?: Error }) {
    super('MATERIALIZATION_FAILED', `Invalid ${schemaId}: ${validationErrors.join('; ')}`, false, options);
    this.name = 'MaterializationError';
    this.schemaId = schemaId;
    this.validationErrors = validationErrors;
  }

  public override toJson() {
    return {
      ...super.toJson(),
      'schemaId': this.schemaId,
      'validationErrors': this.validationErrors
    };
  }
}
