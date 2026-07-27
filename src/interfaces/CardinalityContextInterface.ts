import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { RelationsPushContextInterface } from './RelationsPushContextInterface.js';

/**
 * Extended context for cardinality resolution, which also needs the node map.
 *
 * @internal
 */
export interface CardinalityContextInterface extends RelationsPushContextInterface {
  'nodeMap': Map<string, SchemaGraphNodeInterface>;
}
