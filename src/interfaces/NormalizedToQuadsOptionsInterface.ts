import type { AnnotationEmitModeEntity } from '../entities/AnnotationEmitModeEntity.js';
import type { SkolemizeFunctionInterface } from './SkolemizeFunctionInterface.js';

/** Normalized `toQuads` options — all defaults resolved, ready for quad emission. */
export interface NormalizedToQuadsOptionsInterface {
  'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFunctionInterface | undefined;
}
