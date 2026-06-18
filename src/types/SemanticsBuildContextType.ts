import type { GraphAccessorInterface } from '../interfaces/GraphAccessorInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';

/**
 * Context object passed to `buildSemanticsGraphPart` and `buildSemantics`.
 *
 * @remarks
 * Bundles the graph accessor, node, ref string, local-ref resolver, and raw
 * schema record into a single context shape so the semantic builder helpers
 * do not need separate parameters.
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type SemanticsBuildContextType = {
  /** Live graph accessor for child/entry resolution. */
  readonly 'graph': GraphAccessorInterface;
  /** The schema node being processed. */
  readonly 'node': SchemaGraphNodeType;
  /** Resolved `$ref` string or undefined. */
  readonly 'ref': string | undefined;
  /** Callback to resolve a local fragment reference. */
  readonly 'resolveLocalRef': (ref: string) => SchemaGraphNodeType;
  /** The raw schema record from `node.schema`. */
  readonly 'schema': Record<string, unknown>;
};
