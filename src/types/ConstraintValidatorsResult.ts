import type { PlanPreludeType } from '../types/PlanPrelude.js';

/** Compile the additional-properties, complement, and property-names validators. */
export type ConstraintValidatorsResult = Pick<PlanPreludeType, 'additionalValidator' | 'complementValidator' | 'propertyNamesValidator'>;
