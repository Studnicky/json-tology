import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

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
 * const entry: DependentSchemaValidatorEntryInterface = {
 *   trigger: 'creditCard',
 *   validator: validateBillingAddress,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @group Validation
 */
export interface DependentSchemaValidatorEntryInterface {
  'trigger': StringValueEntity.Type;
  'validator': ValidateWithErrorsFunctionInterface;
}
