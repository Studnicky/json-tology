import type {
  SchemaGraphNodeType, SchemaGraphRelationType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { GraphAccessorInterface } from '../interfaces/GraphAccessor.js';

/**
 * Common context bundle for relation-push helpers that need graph + node + semantics.
 * Satisfies the 3-parameter limit by packing the trio into one options object.
 *
 * @internal
 */
export type RelationsContextType = {
  readonly 'graph': GraphAccessorInterface;
  readonly 'node': SchemaGraphNodeType;
  readonly 'sem': SchemaGraphSemanticsType;
};

/**
 * Extended context that also carries the mutable accumulator.
 *
 * @internal
 */
export type RelationsPushContextType = RelationsContextType & {
  readonly 'relations': SchemaGraphRelationType[];
};

/**
 * Extended context for cardinality resolution, which also needs the node map.
 *
 * @internal
 */
export type CardinalityContextType = RelationsPushContextType & {
  readonly 'nodeMap': Map<string, SchemaGraphNodeType>;
};

/**
 * Extended context for union/type relations, which also needs the pre-filtered non-null types.
 *
 * @internal
 */
export type TypeRelationsContextType = RelationsPushContextType & {
  readonly 'nonNullTypes': string[];
};
