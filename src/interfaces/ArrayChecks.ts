import type {
  CheckFnType, OptionalCheckFnType
} from '../types/Validation.js';

/** Compiled array constraint checks passed to `runArrayChecks`. */
export interface ArrayChecksInterface {
  readonly 'containsCheck': OptionalCheckFnType;
  readonly 'itemCheck': OptionalCheckFnType;
  readonly 'maxContains': number | undefined;
  readonly 'maxItems': number | undefined;
  readonly 'minContains': number | undefined;
  readonly 'minItems': number | undefined;
  readonly 'prefixChecks': CheckFnType[] | undefined;
  readonly 'uniqueItems': boolean;
}
