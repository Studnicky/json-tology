import type { IdentityType } from './IdentityType.js';

export type InvariantFunctionType<T = unknown> = (value: T) => null | string | undefined;

export type InvariantType<T = unknown> = IdentityType<{
  'fn': InvariantFunctionType<T>;
  'name': string;
  /** JSON Pointer for the error location. Defaults to '' (root). */
  'pointer'?: string;
}>;
