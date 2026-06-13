import type { CheckFnType } from '../types/Validation.js';

/** Options for `runContainsCheck`. */
export interface ContainsCheckOptionsInterface {
  readonly 'containsCheck': CheckFnType;
  readonly 'maxContains': number | undefined;
  readonly 'minContains': number | undefined;
  readonly 'value': unknown[];
}
