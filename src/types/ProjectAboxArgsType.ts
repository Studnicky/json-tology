import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LookupGraphFnType } from '../types/LookupGraphFnType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';
import type { SkolemizeFnType } from '../types/SkolemizeFnType.js';

/** Arguments for the projectAbox function. */
export type ProjectAboxArgsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'baseIri': string;
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'data': unknown;
  readonly 'entryNode'?: SchemaGraphNodeType | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'graphIri'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
  readonly 'lookupGraph'?: LookupGraphFnType | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
};
