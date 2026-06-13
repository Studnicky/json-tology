import type { RefTargetInterface } from './RefTarget.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { LookupGraphFn } from '../types/LookupGraphFn.js';

/** Arguments for walkProjectionProperties — recursive effective-property collection. */
export interface WalkProjectionPropertiesArgsInterface {
  readonly 'collected': Map<string, RefTargetInterface>;
  readonly 'current': SchemaGraphNodeInterface;
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'lookupGraph': LookupGraphFn | undefined;
  readonly 'visited': Set<SchemaGraphNodeInterface>;
}
