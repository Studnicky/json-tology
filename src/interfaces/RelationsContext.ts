import type {
  SchemaGraphNodeInterface, SchemaGraphRelationInterface, SchemaGraphSemanticsInterface
} from './SchemaGraph.js';
import type { GraphAccessorInterface } from './GraphAccessor.js';

/**
 * Common context bundle for relation-push helpers that need graph + node + semantics.
 * Satisfies the 3-parameter limit by packing the trio into one options object.
 *
 * @internal
 */
export interface RelationsContextInterface {
  readonly 'graph': GraphAccessorInterface;
  readonly 'node': SchemaGraphNodeInterface;
  readonly 'sem': SchemaGraphSemanticsInterface;
}

/**
 * Extended context that also carries the mutable accumulator.
 *
 * @internal
 */
export interface RelationsPushContextInterface extends RelationsContextInterface {
  readonly 'relations': SchemaGraphRelationInterface[];
}

/**
 * Extended context for cardinality resolution, which also needs the node map.
 *
 * @internal
 */
export interface CardinalityContextInterface extends RelationsPushContextInterface {
  readonly 'nodeMap': Map<string, SchemaGraphNodeInterface>;
}

/**
 * Extended context for union/type relations, which also needs the pre-filtered non-null types.
 *
 * @internal
 */
export interface TypeRelationsContextInterface extends RelationsPushContextInterface {
  readonly 'nonNullTypes': string[];
}
