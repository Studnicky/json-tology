import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';

/**
 * A cached pair of a schema node and its resolved semantics, used by the
 * oneOf discriminator path in {@link VisitComposition}.
 *
 * @internal
 */
export type VariantEntryType = {
  'node': SchemaGraphNodeType;
  'sem': SchemaGraphSemanticsType;
};
