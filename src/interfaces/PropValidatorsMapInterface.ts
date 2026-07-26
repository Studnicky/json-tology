import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';

/**
 * A map from property name to its compiled validator function.
 *
 * @remarks
 * Built once per object schema node during compilation. Keyed by property name
 * as it appears in the JSON Schema `properties` object. At validation time the
 * engine looks up each property's validator in O(1) and invokes it.
 *
 * @category Validation
 * @since 0.1.0
 */
export interface PropValidatorsMapInterface extends Map<string, ValidateWithErrorsFunctionInterface> {}
