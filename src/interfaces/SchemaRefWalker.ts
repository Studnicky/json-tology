/**
 * SchemaRefWalker interface — stateless tree walker for $ref and $id collection.
 */

export interface SchemaRefWalkerInterface {
  /**
   * Walk the schema tree and throw GraphError(REF_UNRESOLVED) on the first
   * $ref that cannot be resolved against knownIds or embeddedIds.
   *
   * @param node - schema node or sub-tree to walk
   * @param parentSchemaId - schema $id that owns this node (for error messages)
   * @param embeddedIds - $id values embedded in the owning schema
   * @param knownIds - membership test against the registry store
   * @param resolve - CURIE expansion callback
   */
  assertResolvable(
    node: unknown,
    parentSchemaId: string,
    embeddedIds: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): void;

  /**
   * Recursively collect all $id strings embedded in a schema tree.
   * The ids Set is mutated in place.
   */
  collectEmbeddedIds(node: unknown, ids: Set<string>): void;

  /**
   * Walk a schema node and collect all non-fragment cross-schema $ref IRIs
   * that are not yet registered. Appends unresolved IRIs into `out`.
   *
   * @param node - schema node or sub-tree to walk
   * @param embeddedIds - $id values embedded in the top-level schema (excluded from unresolved)
   * @param out - accumulator for unresolved ref IRIs
   * @param knownIds - membership test against the registry store
   * @param resolve - CURIE expansion callback (identity when no curie map)
   */
  collectRefsInNode(
    node: unknown,
    embeddedIds: Set<string>,
    out: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): void;

  /**
   * Collect all non-fragment cross-schema $ref IRIs reachable from the given
   * schema that are not yet registered. Convenience wrapper over
   * collectEmbeddedIds + collectRefsInNode.
   *
   * @param schema - top-level schema record
   * @param knownIds - membership test against the registry store
   * @param resolve - CURIE expansion callback
   */
  collectUnresolved(
    schema: Record<string, unknown>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): ReadonlySet<string>;
}
