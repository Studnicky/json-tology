import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { NodeSupportContextType } from './NodeSupportContext.js';

/** Options for `checkRefNodeSupport`. */
export type RefNodeSupportOptionsType = NodeSupportContextType & {
  readonly 'ref': string;
  readonly 'refTargetNode': SchemaGraphNodeType | undefined;
};
