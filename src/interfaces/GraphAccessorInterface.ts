import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../types/SchemaGraph.js';

export interface GraphAccessorInterface {
  child(node: SchemaGraphNodeType, key: string): SchemaGraphNodeType | undefined;
  /**
   * Return the explicit domain node recorded during lower() for a property
   * node. Returns `undefined` for non-property nodes.
   */
  domainOf(node: SchemaGraphNodeType): SchemaGraphNodeType | undefined;
  entries(node: SchemaGraphNodeType, key: string): Array<[string, SchemaGraphNodeType]>;
  indexedChildren(node: SchemaGraphNodeType, key: string): SchemaGraphNodeType[];
  resolveReferenceId(ref: string): string;
  semantics(node: SchemaGraphNodeType): SchemaGraphSemanticsType;
}
