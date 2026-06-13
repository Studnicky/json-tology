import type { PlanPreludeInterface } from '../interfaces/PlanPrelude.js';

/** Compile the additional-properties, complement, and property-names validators. */
export type ConstraintValidatorsResult = Pick<PlanPreludeInterface, 'additionalValidator' | 'complementCheck' | 'propertyNamesValidator'>;
