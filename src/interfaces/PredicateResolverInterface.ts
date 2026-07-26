import type { JsonSchemaType } from '../types/Schema.js';

/**
 * Resolves the predicate IRI to use for a given class/property pair during projection.
 *
 * A call-signature interface, not schema-derived data — the rule conflict this shape resolves
 * (`@typescript-eslint/prefer-function-type` vs `@studnicky/type-alias-invariants`/
 * `folder-content-shape`) is documented in `eslint.config.mjs` and in
 * `noocodec-substrate/docs/eslint/known-issues/type-alias-invariants-prefer-function-type.md`.
 */
export interface PredicateResolverInterface {
  (context: {
    readonly 'classId': string;
    readonly 'propertyName': string;
    readonly 'propertySchema': JsonSchemaType;
  }): string;
}
