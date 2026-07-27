/**
 * Consumer-supplied hook resolving the predicate IRI for a property during ABox lifting.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface PredicateForInterface {
  (context: {
    readonly 'classId': string;
    readonly 'propertyName': string;
  }): string | undefined;
  readonly 'predicateForBrand'?: unique symbol;
}
