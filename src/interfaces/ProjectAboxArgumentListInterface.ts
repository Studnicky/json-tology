import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { CurieInterface } from './CurieInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { AnnotationEmitModeEntity } from '../entities/AnnotationEmitModeEntity.js';
import type { LookupGraphFunctionInterface } from './LookupGraphFunctionInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { SkolemizeFunctionInterface } from './SkolemizeFunctionInterface.js';
import type { InferType } from '../types/Schema.js';
import type { PROJECT_ABOX_ARGUMENT_LIST_SCHEMA } from '../constants/SCHEMAS.js';

/** Arguments for the projectAbox function. */
export interface ProjectAboxArgumentListInterface extends InferType<typeof PROJECT_ABOX_ARGUMENT_LIST_SCHEMA> {
  'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
  'curie'?: CurieInterface | undefined;
  'data': unknown;
  'entryNode'?: SchemaGraphNodeInterface | undefined;
  'graph': SchemaGraphInterface;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFunctionInterface | undefined;
  'lookupGraph'?: LookupGraphFunctionInterface | undefined;
  'predicateResolver'?: PredicateResolverInterface | undefined;
}
