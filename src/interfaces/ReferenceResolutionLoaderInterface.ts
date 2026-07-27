/**
 * ReferenceResolutionLoaderInterface — contract for transitive $ref resolution.
 *
 * Walks all registered schemas, calls the loader for every unregistered
 * cross-schema IRI, and recurses until the registry is fully closed under
 * $ref. Throws `GraphError('REF_UNRESOLVED')` when the loader returns null.
 *
 * @internal — not part of the public package surface; consumers use
 * `LoaderInterface` from `json-tology/interfaces` and `JsonTology.prefetch` instead.
 */

import type { LoaderInterface } from './LoaderInterface.js';

export interface ReferenceResolutionLoaderInterface {
  /**
   * Loads a set of root IRIs into the registry via the loader, skipping any
   * that are already registered. Throws `GraphError('REF_UNRESOLVED')` when
   * the loader returns null for a required IRI.
   *
   * @param rootIds - IRIs to seed the registry from.
   * @param loader - Async loader called for each unregistered IRI.
   */
  loadRootIds(rootIds: readonly string[], loader: LoaderInterface): Promise<void>;

  /**
   * Eagerly resolves all transitive `$ref` IRIs reachable from the schemas
   * currently in the registry.
   *
   * @param loader - Async loader called for each unregistered IRI.
   */
  resolveAll(loader: LoaderInterface): Promise<void>;
}
