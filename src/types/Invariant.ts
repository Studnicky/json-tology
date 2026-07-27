import type { IdentityType } from './IdentityType.js';
import type { InvariantFunctionInterface } from '../interfaces/InvariantFunctionInterface.js';

export type InvariantType<T = unknown> = IdentityType<{
  'fn': InvariantFunctionInterface<T>;
  'name': string;
  /** JSON Pointer for the error location. Defaults to '' (root). */
  'pointer'?: string;
}>;
