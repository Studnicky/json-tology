import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { SkolemizeFnType } from './SkolemizeFnType.js';

export type NormalizedToQuadsOptionsType = {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFnType | undefined;
};
