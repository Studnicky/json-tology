import type { InvariantFnType } from '../types/Invariant.js';

export interface InvariantInterface<T = unknown> {
  'fn': InvariantFnType<T>;
  'name': string;
  /** JSON Pointer for the error location. Defaults to '' (root). */
  'pointer'?: string;
}
