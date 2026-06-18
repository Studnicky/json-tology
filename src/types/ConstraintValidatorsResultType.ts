import type { PlanPreludeType } from '../types/PlanPreludeType.js';

/** Compile the additional-properties, complement, and property-names validators. */
export type ConstraintValidatorsResultType = Pick<PlanPreludeType, 'additionalValidator' | 'complementValidator' | 'propertyNamesValidator'>;
