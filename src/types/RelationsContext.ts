import type {
  SchemaGraphNodeType, SchemaGraphRelationType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { GraphAccessorInterface } from '../interfaces/GraphAccessorInterface.js';
import type { IdentityType } from './IdentityType.js';

/**
 * Common context bundle for relation-push helpers that need graph + node + semantics.
 * Satisfies the 3-parameter limit by packing the trio into one options object.
 *
 * @internal
 */
export type RelationsContextType = IdentityType<{
  'graph': GraphAccessorInterface;
  'node': SchemaGraphNodeType;
  'sem': SchemaGraphSemanticsType;
}>;

/**
 * Extended context that also carries the mutable accumulator.
 *
 * @internal
 */
export type RelationsPushContextType = RelationsContextType & {
  'relations': SchemaGraphRelationType[];
};

/**
 * Extended context for cardinality resolution, which also needs the node map.
 *
 * @internal
 */
export type CardinalityContextType = RelationsPushContextType & {
  'nodeMap': Map<string, SchemaGraphNodeType>;
};

/**
 * Extended context for union/type relations, which also needs the pre-filtered non-null types.
 *
 * @internal
 */
export type TypeRelationsContextType = RelationsPushContextType & {
  'nonNullTypes': string[];
};
