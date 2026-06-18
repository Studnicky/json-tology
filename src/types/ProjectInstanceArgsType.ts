import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectBaseArgsType } from './ProjectBaseArgsType.js';

/**
 * Arguments passed to the instance-level ABox projection entry point.
 *
 * @remarks
 * Composes {@link ProjectBaseArgsType} with the fields specific to projecting a
 * single JSON object (one ABox individual) into a set of RDF quads. The
 * `visited` WeakSet (on the base) guards against circular references;
 * `lookupGraph` (on the base) enables cross-schema $ref resolution to foreign
 * graphs.
 *
 * @example
 * ```ts
 * const args: ProjectInstanceArgsType = {
 *   curie, data, depth: 0, graph, graphTerm, minter, node, path: '/',
 *   predicateResolver, quadOpts, quads: [], visited: new WeakSet(),
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectPropertyArgsType}
 * @group ABox
 */
export type ProjectInstanceArgsType = ProjectBaseArgsType & {
  readonly 'data': Record<string, unknown>;
  readonly 'node': SchemaGraphNodeType;
};
