import type { CurieInterface } from './Curie.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { LookupGraphFn } from '../types/LookupGraphFn.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { SkolemizeFnType } from '../types/Skolemize.js';

/** Arguments for the projectAbox function. */
export interface ProjectAboxArgsInterface {
  readonly 'baseIRI': string;
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'data': unknown;
  readonly 'entryNode'?: SchemaGraphNodeInterface | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
  readonly 'lookupGraph'?: LookupGraphFn | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
}
