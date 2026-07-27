/**
 * Lifts a resource IRI to its typed JS instance (memoised by the owning graph).
 *
 * A callable signature, not schema-derived data — authored as an interface
 * with a call signature rather than a type alias.
 */
export interface AboxLiftFunctionInterface {
  (iri: string): unknown;
  readonly 'aboxLiftFunctionBrand'?: unique symbol;
}
