import type { QuadObjectType } from '../types/quad.js';

export interface QuadInterface {
  'graph'?: string;
  'object': QuadObjectType;
  'predicate': string;
  'subject': string;
}
