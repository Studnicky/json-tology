import type { JsonSchemaType } from '../types/Schema.js';

/**
 * Resolves the predicate IRI to use for a given class/property pair during projection.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface PredicateResolverInterface {
  (context: {
    readonly 'classId': string;
    readonly 'propertyName': string;
    readonly 'propertySchema': JsonSchemaType;
  }): string;
  readonly 'predicateResolverBrand'?: unique symbol;
}
