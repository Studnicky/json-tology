/** @internal — OWL predicate helper shape used only within OwlImporter dispatchers. */
export interface SimplePredicateEntry {
  readonly 'coerce'?: (value: string) => unknown;
  readonly 'datatype': string;
}
