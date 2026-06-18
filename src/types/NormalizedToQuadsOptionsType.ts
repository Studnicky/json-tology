import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { SkolemizeFnType } from './SkolemizeFnType.js';

export type NormalizedToQuadsOptionsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
};
