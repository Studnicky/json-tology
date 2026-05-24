import type { CurieInterface } from '../interfaces/Curie.js';
import type { SkolemizeFnType } from './Skolemize.js';

export interface AboxOptionsType {
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
}
