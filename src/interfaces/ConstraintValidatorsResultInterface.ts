import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';

/**
 * Compile the additional-properties, complement, and property-names validators.
 *
 * @remarks
 * Spells out the exact three {@link PlanPreludeInterface} fields this compilation
 * step produces, so the shape stays explicit and self-contained instead of
 * positionally subsetting the canonical prelude type.
 */
export interface ConstraintValidatorsResultInterface {
  'additionalValidator': undefined | ValidateWithErrorsFunctionInterface;
  'complementValidator': undefined | ValidateWithErrorsFunctionInterface;
  'propertyNamesValidator': undefined | ValidateWithErrorsFunctionInterface;
}
