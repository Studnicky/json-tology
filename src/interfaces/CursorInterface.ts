/**
 * CursorInterface — a lazy, immutable, typed selection of resources in an ABox graph.
 *
 * Each navigation method returns a NEW Cursor; the original is unmodified.
 * Terminals materialize the current IRI set into typed JS instances.
 */
export interface CursorInterface {
  // ---------------------------------------------------------------------------
  // Navigation (Cursor → Cursor)
  // ---------------------------------------------------------------------------

  /**
   * Return all typed instances in the current selection.
   * Alias: `.resources()`.
   */
  all(): unknown[];

  /**
   * Count the number of resources in the current selection.
   */
  count(): number;

  // ---------------------------------------------------------------------------
  // Refinement (Cursor → Cursor)
  // ---------------------------------------------------------------------------

  /**
   * Return the first typed instance, or `undefined` when the selection is empty.
   */
  first(): unknown;

  /**
   * Keep only IRIs whose `predicate` object equals `value` (exact match after decoding).
   */
  having(predicate: string, value: unknown): CursorInterface;

  /**
   * Return the underlying IRIs of the current selection.
   */
  iris(): string[];

  // ---------------------------------------------------------------------------
  // Terminals
  // ---------------------------------------------------------------------------

  /**
   * Return `true` when the selection contains no resources.
   */
  none(): boolean;

  /**
   * Follow `predicate` forward from each current IRI and collect the objects.
   *
   * - An array argument is treated as a union (SPARQL `a|b` alternative).
   * - Predicates may be authored property names (`'customerId'`) or full IRIs.
   * - Literal objects that match an inverse-functional identity entry are
   *   resolved to the owning entity IRI (FK resolution).
   */
  objects(predicate: string | string[]): CursorInterface;

  /**
   * Keep only IRIs whose `rdf:type` is `classIri` (direct type match).
   */
  ofType(classIri: string): CursorInterface;

  /**
   * Return the single typed instance.
   *
   * @throws {GraphError} code `CURSOR_CARDINALITY` when the selection contains
   *   zero or more than one resource.
   */
  one(): unknown;

  /**
   * Return all typed instances in the current selection.
   * Alias for `.all()`.
   */
  resources(): unknown[];

  /**
   * Return `true` when the selection contains at least one resource.
   */
  some(): boolean;

  /**
   * Follow `predicate` in reverse from each current IRI and collect the subjects.
   *
   * Inverse of `.objects`: finds every subject whose object for `predicate`
   * equals a current IRI, plus subjects whose FK literal resolves to a current IRI.
   */
  subjects(predicate: string | string[]): CursorInterface;

  /**
   * Lift each current IRI to its typed instance and keep those where `fn` returns `true`.
   */
  where(fn: (instance: unknown) => boolean): CursorInterface;
}
