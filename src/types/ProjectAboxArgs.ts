import type { CurieInterface } from '../interfaces/Curie.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LookupGraphFn } from '../types/LookupGraphFn.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { SkolemizeFnType } from '../types/Skolemize.js';

/** Arguments for the projectAbox function. */
export type ProjectAboxArgsType = {
  readonly 'baseIRI': string;
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'data': unknown;
  readonly 'entryNode'?: SchemaGraphNodeType | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
  readonly 'lookupGraph'?: LookupGraphFn | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
};
