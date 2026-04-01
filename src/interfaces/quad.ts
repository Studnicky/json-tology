import type { QuadObjectType } from '../types/Quad.js';

export interface QuadInterface {
  'graph'?: string;
  'object': QuadObjectType;
  'predicate': string;
  'subject': string;
}
