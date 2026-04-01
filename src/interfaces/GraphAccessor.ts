import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from './SchemaGraph.js';

export interface GraphAccessor {
  child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined;
  entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]>;
  indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[];
  resolveRefId(ref: string): string;
  semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface;
}
