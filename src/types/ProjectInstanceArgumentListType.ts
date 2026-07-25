import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectBaseArgumentListType } from './ProjectBaseArgumentListType.js';

/**
 * Arguments passed to the instance-level ABox projection entry point.
 *
 * @remarks
 * Composes {@link ProjectBaseArgumentListType} with the fields specific to projecting a
 * single JSON object (one ABox individual) into a set of RDF quads. The
 * `visited` WeakSet (on the base) guards against circular references;
 * `lookupGraph` (on the base) enables cross-schema $ref resolution to foreign
 * graphs.
 *
 * @example
 * ```ts
 * const args: ProjectInstanceArgumentListType = {
 *   curie, data, depth: 0, graph, graphTerm, minter, node, path: '/',
 *   predicateResolver, quadOpts, quads: [], visited: new WeakSet(),
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectPropertyArgumentListType}
 * @group ABox
 */
export type ProjectInstanceArgumentListType = ProjectBaseArgumentListType & {
  'data': Record<string, unknown>;
  'node': SchemaGraphNodeType;
};
