import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type {
  DepRequiredEntriesType, OptionalValidateWithErrorsFnType
} from '../types/Validation.js';

/** Result of `buildPlanPrelude` — the non-composition, non-conditional plan fragments. */
export type PlanPreludeType = {
  'additionalValidator': OptionalValidateWithErrorsFnType;
  'complementValidator': OptionalValidateWithErrorsFnType;
  'depRequiredEntries': DepRequiredEntriesType;
  'formatValidator': ReturnType<FormatRegistryInterface['get']> | undefined;
  'patternRegex': RegExp | undefined;
  'propertyNamesValidator': OptionalValidateWithErrorsFnType;
};
