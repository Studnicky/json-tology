import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { SkolemizeFunctionType } from './SkolemizeFunctionType.js';
import type { InferType } from './Schema.js';
import type { NORMALIZED_TO_QUADS_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

export type NormalizedToQuadsOptionsType = InferType<typeof NORMALIZED_TO_QUADS_OPTIONS_SCHEMA> & {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFunctionType | undefined;
};
