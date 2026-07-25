/**
 * AboxGraphInterface — the graph view returned by `jt.aboxGraph(quads)`.
 *
 * Provides two entry points that each return a {@link CursorInterface}
 * over the selected resource set.
 */

import type { CursorInterface } from './CursorInterface.js';
import type { SchemaCursorInterface } from './SchemaCursorInterface.js';
import type { PredicateAccessorType } from '../types/PredicateAccessorType.js';

export interface AboxGraphInterface {
  /**
   * Return a schema cursor seeded with the single class identified by `classIri`,
   * for schema-level navigation (`subClassOf`, `properties`).
   *
   * @param classIri - Full class IRI.
   */
  class(classIri: string): SchemaCursorInterface;

  /**
   * Return a cursor seeded with every resource whose `rdf:type` is `classIri`.
   *
   * @param classIri - Full class IRI to match against the typeOf index.
   */
  instances(classIri: string): CursorInterface;

  /**
   * Return the schema-level domain/range accessors for a predicate (resolved
   * from an authored property name or a full IRI). Each accessor yields a
   * {@link SchemaCursorInterface} over the class IRIs in that TBox role.
   *
   * @param name - Authored property name (e.g. `'customerId'`) or full predicate IRI.
   */
  predicate(name: string): PredicateAccessorType;

  /**
   * Return a cursor seeded with the single resource identified by `iri`.
   *
   * @param iri - Full subject IRI of the resource.
   */
  resource(iri: string): CursorInterface;
}
