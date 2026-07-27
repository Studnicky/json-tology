import type { UniqueItemsBrandInterface } from './UniqueItemsBrandInterface.js';
import type { UNIQUE_ARRAY } from '../types/ConstraintBrands.js';

/**
 * Generic uniqueness brand parameterised by element type. Lets downstream APIs
 * assume distinctness post-validation. Produced by `JsonTology.instantiate`
 * and `JsonTology.materialize` when the source schema declares
 * `uniqueItems: true`. Plain arrays cannot satisfy this brand without going
 * through the validation API.
 *
 * @remarks
 * Extends {@link UniqueItemsBrandInterface} and adds the element-type
 * parameter so APIs that require `ReadonlyArray<T>` can additionally require
 * that the array was validated for uniqueness.
 *
 * @example
 * ```ts
 * declare const t: UniqueArrayBrandInterface<string>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueItemsBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam T - The element type of the unique array.
 */
export interface UniqueArrayBrandInterface<T> extends UniqueItemsBrandInterface {
  readonly [UNIQUE_ARRAY]: T;
}
