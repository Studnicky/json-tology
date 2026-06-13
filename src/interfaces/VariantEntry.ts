import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from './SchemaGraph.js';

/**
 * A cached pair of a schema node and its resolved semantics, used by the
 * oneOf discriminator path in {@link VisitComposition}.
 *
 * @internal
 */
export interface VariantEntryInterface {
  'node': SchemaGraphNodeInterface;
  'sem': SchemaGraphSemanticsInterface;
}
