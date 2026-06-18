/**
 * SchemaRefWalker interface — stateless tree walker for $ref and $id collection.
 *
 * @internal — not part of the public package surface; consumed only by
 * SchemaRegistry's ref-resolution pipeline.
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
   * schema that are not yet registered. The caller supplies the embedded-$id
   * set derived from the canonical graph (`SchemaGraph.embeddedSchemaIds`) so
   * the walker never performs its own embedded-id collection.
   *
   * @param schema - top-level schema record
   * @param embeddedIds - embedded $id values (graph-derived) to exclude from unresolved
   * @param knownIds - membership test against the registry store
   * @param resolve - CURIE expansion callback
   */
  collectUnresolved(
    schema: Record<string, unknown>,
    embeddedIds: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): ReadonlySet<string>;
}
