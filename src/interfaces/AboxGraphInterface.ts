/**
 * AboxGraphInterface — the graph view returned by `jt.aboxGraph(quads)`.
 *
 * Provides two entry points that each return a {@link CursorInterface}
 * over the selected resource set.
 */

import type { CursorInterface } from './CursorInterface.js';

export interface AboxGraphInterface {
  /**
   * Return a cursor seeded with every resource whose `rdf:type` is `classIri`.
   *
   * @param classIri - Full class IRI to match against the typeOf index.
   */
  instances(classIri: string): CursorInterface;

  /**
   * Return a cursor seeded with the single resource identified by `iri`.
   *
   * @param iri - Full subject IRI of the resource.
   */
  resource(iri: string): CursorInterface;
}
