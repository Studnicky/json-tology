import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { ProjectBaseArgumentListInterface } from './ProjectBaseArgumentListInterface.js';

/**
 * Arguments passed to the instance-level ABox projection entry point.
 *
 * @remarks
 * Composes {@link ProjectBaseArgumentListInterface} with the fields specific to projecting a
 * single JSON object (one ABox individual) into a set of RDF quads. The
 * `visited` WeakSet (on the base) guards against circular references;
 * `lookupGraph` (on the base) enables cross-schema $ref resolution to foreign
 * graphs.
 *
 * @example
 * ```ts
 * const args: ProjectInstanceArgumentListInterface = {
 *   curie, data, depth: 0, graph, graphTerm, minter, node, path: '/',
 *   predicateResolver, quadOpts, quads: [], visited: new WeakSet(),
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectPropertyArgumentListInterface}
 * @group ABox
 */
export interface ProjectInstanceArgumentListInterface extends ProjectBaseArgumentListInterface {
  'data': Record<string, unknown>;
  'node': SchemaGraphNodeInterface;
}
