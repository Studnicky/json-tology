import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LookupGraphFunctionType } from '../types/LookupGraphFunctionType.js';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';
import type { SkolemizeFunctionType } from '../types/SkolemizeFunctionType.js';
import type { InferType } from './Schema.js';
import type { PROJECT_ABOX_ARGUMENT_LIST_SCHEMA } from '../constants/SCHEMAS.js';

/** Arguments for the projectAbox function. */
export type ProjectAboxArgumentListType = InferType<typeof PROJECT_ABOX_ARGUMENT_LIST_SCHEMA> & {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'curie'?: CurieInterface | undefined;
  'data': unknown;
  'entryNode'?: SchemaGraphNodeType | undefined;
  'graph': SchemaGraphInterface;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFunctionType | undefined;
  'lookupGraph'?: LookupGraphFunctionType | undefined;
  'predicateResolver'?: PredicateResolverFunctionType | undefined;
};
