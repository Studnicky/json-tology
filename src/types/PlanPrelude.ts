import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type {
  DepRequiredEntriesType, OptionalValidateWithErrorsFnType
} from '../types/Validation.js';

/** Result of `buildPlanPrelude` — the non-composition, non-conditional plan fragments. */
export type PlanPreludeType = {
  readonly 'additionalValidator': OptionalValidateWithErrorsFnType;
  readonly 'complementValidator': OptionalValidateWithErrorsFnType;
  readonly 'depRequiredEntries': DepRequiredEntriesType;
  readonly 'formatValidator': ReturnType<FormatRegistryInterface['get']> | undefined;
  readonly 'patternRegex': RegExp | undefined;
  readonly 'propertyNamesValidator': OptionalValidateWithErrorsFnType;
};
