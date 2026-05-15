import type { SkolemizeFnType } from './Skolemize.js';

export interface AboxOptionsType {
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
}
