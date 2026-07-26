import type { SubClassOfOptionsEntity } from '../entities/SubClassOfOptionsEntity.js';

/**
 * SchemaCursorInterface — a lazy, immutable selection of class IRIs in the TBox.
 *
 * Exposes navigation over the schema hierarchy and terminals that lift class IRIs
 * to their authored JSON Schema objects. Returned by `AboxGraph.predicate(name).domain()`,
 * `.range()`, and `AboxGraph.class(classIri)`.
 */
export interface SchemaCursorInterface {
  /**
   * Return all class schemas for the current selection (one per class IRI).
   */
  all(): unknown[];

  /**
   * Count the number of class IRIs in the current selection.
   */
  count(): number;

  /**
   * Return the underlying class IRIs of the current selection.
   */
  iris(): string[];

  /**
   * Return the single class schema.
   *
   * @throws {GraphError} code `CURSOR_CARDINALITY` when the selection contains
   *   zero or more than one class IRI.
   */
  one(): unknown;

  /**
   * Return the predicate IRIs (or authored property names) whose `rdfs:domain`
   * includes any class in the current selection.
   */
  properties(): string[];

  /**
   * Navigate to the direct superclasses (`rdfs:subClassOf`) of every class in
   * the current selection.
   *
   * @param options.transitive - When `true`, walk the full superclass chain (BFS,
   *   cycle-guarded) rather than stopping at direct parents.
   */
  subClassOf(options?: SubClassOfOptionsEntity.Type): SchemaCursorInterface;
}
