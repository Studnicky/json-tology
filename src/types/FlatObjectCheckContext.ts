import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { PropCheckType } from './PropCheck.js';

/** Context for `runFlatObjectCheck`. */
export type FlatObjectCheckContextType = {
  readonly 'propChecks': PropCheckType[];
  readonly 'rejectsAdditional': boolean;
  readonly 'semProperties': ReadonlyMap<string, SchemaGraphNodeType>;
};
