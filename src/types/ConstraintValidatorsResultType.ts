import type { OptionalValidateWithErrorsFunctionType } from '../types/Validation.js';

/**
 * Compile the additional-properties, complement, and property-names validators.
 *
 * @remarks
 * Spells out the exact three {@link PlanPreludeType} fields this compilation
 * step produces via `Record` intersection rather than `Pick<PlanPreludeType, ...>`,
 * so the shape stays explicit and self-contained instead of positionally
 * subsetting the canonical prelude type.
 */
export type ConstraintValidatorsResultType = Record<'additionalValidator', OptionalValidateWithErrorsFunctionType>
  & Record<'complementValidator', OptionalValidateWithErrorsFunctionType>
  & Record<'propertyNamesValidator', OptionalValidateWithErrorsFunctionType>;
