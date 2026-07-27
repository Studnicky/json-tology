import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';

/** Result of `buildPlanPrelude` — the non-composition, non-conditional plan fragments. */
export interface PlanPreludeInterface {
  'additionalValidator': undefined | ValidateWithErrorsFunctionInterface;
  'complementValidator': undefined | ValidateWithErrorsFunctionInterface;
  'depRequiredEntries': Array<[string, string[]]>;
  'formatValidator': ReturnType<FormatRegistryInterface['get']> | undefined;
  'patternRegex': RegExp | undefined;
  'propertyNamesValidator': undefined | ValidateWithErrorsFunctionInterface;
}
