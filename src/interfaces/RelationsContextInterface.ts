import type { SchemaGraphSemanticsInterface } from './SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { GraphAccessorInterface } from './GraphAccessorInterface.js';

/**
 * Common context bundle for relation-push helpers that need graph + node + semantics.
 * Satisfies the 3-parameter limit by packing the trio into one options object.
 *
 * @internal
 */
export interface RelationsContextInterface {
  'graph': GraphAccessorInterface;
  'node': SchemaGraphNodeInterface;
  'sem': SchemaGraphSemanticsInterface;
}
