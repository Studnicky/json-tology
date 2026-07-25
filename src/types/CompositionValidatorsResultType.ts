import type { ValidateWithErrorsFunctionType } from '../types/Validation.js';
import type { IdentityType } from './IdentityType.js';

/**
 * Composition validators compiled from `allOf`, `anyOf`, and `oneOf` schema keywords.
 *
 * @remarks
 * Produced once per schema node during compilation. `allOfValidators` collects
 * full validators for error reporting; `anyOfValidators` and `oneOfValidators` are
 * always compiled as full validators so that check-mode isolation, evaluated-set
 * propagation, and value-producing defaults/coercion all use a single unified path.
 * All fields are `undefined` when the corresponding keyword is absent.
 *
 * @example
 * ```ts
 * const comp: CompositionValidatorsResultType = {
 *   allOfValidators: [validateA, validateB],
 *   anyOfValidators: [checkX, checkY],
 *   oneOfValidators: undefined,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ConditionalValidatorsResultType}
 * @group Validation
 */
export type CompositionValidatorsResultType = IdentityType<{
  'allOfValidators': undefined | ValidateWithErrorsFunctionType[];
  'anyOfValidators': undefined | ValidateWithErrorsFunctionType[];
  'oneOfValidators': undefined | ValidateWithErrorsFunctionType[];
}>;
