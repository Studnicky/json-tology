/**
 * CursorInterface — a lazy, immutable, typed selection of resources in an ABox graph.
 *
 * Each navigation method returns a NEW Cursor; the original is unmodified.
 * Terminals materialize the current IRI set into typed JS instances.
 */
export interface CursorInterface {
  // ---------------------------------------------------------------------------
  // Terminals
  // ---------------------------------------------------------------------------

  /**
   * Return all typed instances in the current selection.
   * Alias: `.resources()`.
   */
  all(): unknown[];

  /**
   * Transitive closure over `predicate(s)`: follow the predicate(s) from every
   * current IRI, accumulate all reachable objects, and repeat until no new IRIs
   * are discovered (lazy bounded BFS). Cycle-guarded via a visited set.
   *
   * An array argument is treated as a union of predicates (each hop may follow
   * any of the listed predicates). FK resolution applies the same way as
   * `.objects`.
   */
  closure(predicate: string | string[]): CursorInterface;

  /**
   * Count the number of resources in the current selection.
   */
  count(): number;

  // ---------------------------------------------------------------------------
  // Refinement (Cursor → Cursor)
  // ---------------------------------------------------------------------------

  /**
   * Deduplicate the IRI set. Cursors built via index-backed navigation are
   * already deduplicated; call `.distinct()` after `.union` or for defensive
   * clarity when building a cursor from an external IRI list.
   */
  distinct(): CursorInterface;

  /**
   * Return the first typed instance, or `undefined` when the selection is empty.
   */
  first(): unknown;

  /**
   * Keep only IRIs whose `predicate` object equals `value` (exact match after decoding).
   */
  having(predicate: string, value: unknown): CursorInterface;

  /**
   * Set intersection: keep only IRIs present in BOTH this cursor and `other`.
   * The result is deduplicated and order follows the current cursor's order.
   */
  intersect(other: CursorInterface): CursorInterface;

  /**
   * Return the underlying IRIs of the current selection.
   */
  iris(): string[];

  /**
   * Return the first `n` resources. Returns a new cursor over the truncated IRI list.
   */
  limit(n: number): CursorInterface;

  /**
   * Return `true` when the selection contains no resources.
   */
  none(): boolean;

  // ---------------------------------------------------------------------------
  // Navigation (Cursor → Cursor)
  // ---------------------------------------------------------------------------

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
   * Order the selection by a comparator over the LIFTED typed instances.
   * Stable sort — equal elements preserve their original relative order.
   *
   * @param compare - Comparator function (same contract as `Array.prototype.sort`).
   */
  orderBy(compare: (left: unknown, right: unknown) => number): CursorInterface;

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
   * Expand to the set of resources within `depth` hops from the current seeds,
   * following ALL outgoing predicates (BFS, cycle-guarded). The seeds themselves
   * are always included (depth 0). Depth 1 adds direct neighbours; depth 2 adds
   * their neighbours, and so on.
   */
  subgraph(depth: number): CursorInterface;

  /**
   * Follow `predicate` in reverse from each current IRI and collect the subjects.
   *
   * Inverse of `.objects`: finds every subject whose object for `predicate`
   * equals a current IRI, plus subjects whose FK literal resolves to a current IRI.
   */
  subjects(predicate: string | string[]): CursorInterface;

  /**
   * Set union: combine the IRIs of this cursor and `other`. Duplicates are
   * retained if both cursors contain the same IRI — call `.distinct()` to remove
   * them if needed.
   */
  union(other: CursorInterface): CursorInterface;

  /**
   * Lift each current IRI to its typed instance and keep those where `predicateFunction` returns `true`.
   */
  where(predicateFunction: (instance: unknown) => boolean): CursorInterface;
}
