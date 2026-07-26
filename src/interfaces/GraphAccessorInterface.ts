import type { SchemaGraphSemanticsInterface } from './SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';

export interface GraphAccessorInterface {
  child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined;
  /**
   * Return the explicit domain node recorded during lower() for a property
   * node. Returns `undefined` for non-property nodes.
   */
  domainOf(node: SchemaGraphNodeInterface): SchemaGraphNodeInterface | undefined;
  entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]>;
  indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[];
  resolveReferenceId(ref: string): string;
  semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface;
}
