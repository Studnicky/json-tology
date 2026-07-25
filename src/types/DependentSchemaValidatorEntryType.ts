import type { ValidateWithErrorsFunctionType } from '../types/Validation.js';
import type { IdentityType } from './IdentityType.js';

/**
 * A dependent-schema trigger entry pairing a property name with its validator.
 *
 * @remarks
 * Produced during compilation of `dependentSchemas` keywords. When the
 * `trigger` property is present on the validated object, the associated
 * `validator` is invoked against the whole object to enforce the dependent
 * schema constraints.
 *
 * @example
 * ```ts
 * const entry: DependentSchemaValidatorEntryType = {
 *   trigger: 'creditCard',
 *   validator: validateBillingAddress,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link DependentSchemaValidatorsResultType}
 * @group Validation
 */
export type DependentSchemaValidatorEntryType = IdentityType<{
  'trigger': string;
  'validator': ValidateWithErrorsFunctionType;
}>;
