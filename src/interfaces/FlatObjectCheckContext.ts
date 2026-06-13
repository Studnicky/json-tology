import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { PropCheckInterface } from './PropCheck.js';

/** Context for `runFlatObjectCheck`. */
export interface FlatObjectCheckContextInterface {
  readonly 'propChecks': PropCheckInterface[];
  readonly 'rejectsAdditional': boolean;
  readonly 'semProperties': ReadonlyMap<string, SchemaGraphNodeInterface>;
}
