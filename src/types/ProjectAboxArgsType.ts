import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LookupGraphFnType } from '../types/LookupGraphFnType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';
import type { SkolemizeFnType } from '../types/SkolemizeFnType.js';

/** Arguments for the projectAbox function. */
export type ProjectAboxArgsType = {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'baseIri': string;
  'curie'?: CurieInterface | undefined;
  'data': unknown;
  'entryNode'?: SchemaGraphNodeType | undefined;
  'graph': SchemaGraphInterface;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFnType | undefined;
  'lookupGraph'?: LookupGraphFnType | undefined;
  'predicateResolver'?: PredicateResolverFnType | undefined;
};
