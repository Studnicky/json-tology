import type { IdentityType } from './IdentityType.js';

export type TransformFnsType = IdentityType<{
  'decode': (input: unknown) => unknown;
  'encode': (output: unknown) => unknown;
}>;
