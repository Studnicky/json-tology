import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type {
  DepRequiredEntriesType, OptionalValidateWithErrorsFunctionType
} from '../types/Validation.js';
import type { InferType } from './Schema.js';
import type { PLAN_PRELUDE_SCHEMA } from '../constants/SCHEMAS.js';

/** Result of `buildPlanPrelude` — the non-composition, non-conditional plan fragments. */
export type PlanPreludeType = InferType<typeof PLAN_PRELUDE_SCHEMA> & {
  'additionalValidator': OptionalValidateWithErrorsFunctionType;
  'complementValidator': OptionalValidateWithErrorsFunctionType;
  'depRequiredEntries': DepRequiredEntriesType;
  'formatValidator': ReturnType<FormatRegistryInterface['get']> | undefined;
  'patternRegex': RegExp | undefined;
  'propertyNamesValidator': OptionalValidateWithErrorsFunctionType;
};
