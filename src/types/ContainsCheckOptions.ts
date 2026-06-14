import type { CheckFnType } from '../types/Validation.js';

/** Options for `runContainsCheck`. */
export type ContainsCheckOptionsType = {
  readonly 'containsCheck': CheckFnType;
  readonly 'maxContains': number | undefined;
  readonly 'minContains': number | undefined;
  readonly 'value': unknown[];
};
