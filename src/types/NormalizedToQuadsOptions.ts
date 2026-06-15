import type { AnnotationEmitModeType } from './AnnotationEmitMode.js';
import type { SkolemizeFnType } from './Skolemize.js';

export type NormalizedToQuadsOptionsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
};
